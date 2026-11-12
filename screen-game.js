(function () {
  const stage = document.querySelector('#stage');
  stage.innerHTML = '<header class="mast"><span>ARCADE RACING</span><h1>Face Circuit</h1></header>' +
    '<section id="prep"><h2>Driver lineup</h2><p>Open a test phone, shape your driver and tap Ready.</p><div id="lineup"></div><button id="start">Start race</button></section>' +
    '<section id="race" hidden><div class="board"><canvas width="480" height="270" aria-label="Split-screen chase views of Clover Circuit"></canvas><div id="signal"></div></div>' +
    '<div id="standings"></div><button id="again" hidden>Back to prep</button></section>';
  const get = id => document.getElementById(id);
  const canvas = stage.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const drivers = new Map();
  const laps = 3, lapLength = 2*Math.PI;
  const corners=[[0,151],[115,150],[172,91],[167,-53],[108,-145],[18,-138],[-26,-59],[-89,-76],[-158,-134],[-193,-52],[-176,73],[-112,147]];
  const route=[];
  for(let i=0;i<corners.length;i++) {
    const point=offset=>corners[(i+offset+corners.length)%corners.length];
    const [a,b,c,d]=[-1,0,1,2].map(point);
    for(let j=0;j<24;j++) {
      const t=j/24;
      route.push(b.map((v,k)=>.5*(2*v+(-a[k]+c[k])*t+(2*a[k]-5*v+4*c[k]-d[k])*t*t+(-a[k]+3*v-3*c[k]+d[k])*t*t*t)));
    }
  }
  const next=i=>route[(i+1)%route.length];
  function nearest(x,y) {
    let best={distance:Infinity,progress:0};
    route.forEach(([ax,ay],i)=>{
      const [bx,by]=next(i);
      const dx=bx-ax,dy=by-ay;
      const t=Kart.clamp(((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy),0,1);
      const distance=Math.hypot(x-ax-t*dx,y-ay-t*dy);
      if(distance<best.distance) best={distance,progress:(i+t)/route.length,heading:Math.atan2(dy,dx),x:ax+t*dx,y:ay+t*dy};
    });
    return best;
  }
  let phase = 'lobby', round = 0, startAt = 0, previous = performance.now(), lastSignal = '', finishAt = 0;
  let grid = [], slicks = [];
  const room = Jam.host({
    maxPlayers: 4,
    onPlayerJoin(player) {
      if (player.role === 'player') {
        const seats = room.players().map(p=>p.id);
        for (const id of drivers.keys()) if (!seats.includes(id)) drivers.delete(id);
        drivers.set(player.id,{player,face:Kart.face(null,player.color),ready:false,ability:"pulse"});
      }
      sync(player);
      lineup();
    },
    onPlayerReturn(player) { sync(player); lineup(); },
    onPlayerLeave(player) {
      const d = drivers.get(player.id);
      if (d) d.input = {};
      lineup();
    },
    onMove(player,type,data) {
      const d = drivers.get(player.id);
      if (!d || data?.round !== round) return;
      if (type === 'driver' && phase === 'lobby') {
        d.face = Kart.face(data.face,player.color);
        d.ready = data.ready === true;
        if(Object.hasOwn(Kart.abilities,data.ability)) d.ability=data.ability;
        sync(player);
        lineup();
      }
      if(type==='ability' && phase==='playing' && grid.includes(d)) activate(d);
      if (type === 'drive' && phase === 'playing' && grid.includes(d)) {
        d.input = {gas:data.gas === true, steer:Kart.clamp(Number(data.steer)||0,-1,1)};
        d.inputUntil = performance.now()+750;
      }
    }
  });
  function activate(d) {
    const now=performance.now();
    if(d.finished || now<d.abilityAt || now<d.recoverUntil) return;
    d.abilityAt=now+Kart.abilities[d.ability].cooldown;
    if(d.ability==='boost') d.boostUntil=now+1000;
    if(d.ability==='pulse') {
      grid.filter(other=>other!==d && !other.finished && Math.hypot(other.x-d.x,other.y-d.y)<75)
        .forEach(other=>{other.slowUntil=Math.max(other.slowUntil,now+1500);});
    }
    if(d.ability==='slick') {
      const x=d.x-Math.cos(d.heading)*15,y=d.y-Math.sin(d.heading)*15;
      slicks.push({x,y,owner:d,until:now+12000});
    }
    Jam.sound.beep(330,100);
    room.sendTo(d.player,'cooldown',Kart.abilities[d.ability].cooldown);
  }
  function sync(player) {
    const d = drivers.get(player.id);
    room.sendTo(player,'phase',{name:phase,round,ready:d?.ready,face:d?.face,ability:d?.ability,cooldown:Math.max(0,(d?.abilityAt||0)-performance.now())});
  }
  function setPhase(name) {
    phase = name;
    room.players().forEach(sync);
  }
  function lineup() {
    const active = room.players().map(p=>drivers.get(p.id)).filter(Boolean);
    get('lineup').innerHTML = active.map(d=>'<article><svg viewBox="0 0 100 100">'+Kart.avatar(d.face)+
      '</svg><strong>Player '+d.player.slot+'</strong><span>'+(d.ready?'Ready':'Editing')+' · '+Kart.abilities[d.ability].name+'</span></article>').join('');
    get('start').disabled = !active.length || active.some(d=>!d.ready);
  }
  get('start').onclick = () => {
    grid = room.players().map(p=>drivers.get(p.id)).filter(d=>d?.ready);
    if (!grid.length) return;
    Jam.sound.unlock();
    grid.forEach((d,i)=>{
      const [x,y]=route[0];
      const heading=nearest(x,y).heading;
      const offset=(i-(grid.length-1)/2)*11;
      Object.assign(d,{x:x-Math.sin(heading)*offset,y:y+Math.cos(heading)*offset,heading,
        progress:0,total:0,speed:0,input:{},inputUntil:0,finished:0,lap:0,recoverUntil:0});
    });
    slicks=[];
    grid.forEach(d=>Object.assign(d,{abilityAt:0,boostUntil:0,slowUntil:0}));
    round++;
    lastSignal = '';
    finishAt = 0;
    startAt = performance.now()+3000;
    room.showJoin(false);
    get('prep').hidden = true;
    get('race').hidden = false;
    get('again').hidden = true;
    setPhase('countdown');
  };
  get('again').onclick = () => {
    drivers.forEach(d=>{d.ready=false;});
    get('race').hidden=true;
    get('prep').hidden=false;
    room.showJoin(true);
    setPhase('lobby');
    lineup();
  };
  // Bake the flat circuit once. Each camera samples it with a different
  // rotation and scale per scanline, like a Mode 7 ground plane.
  const texture = document.createElement('canvas');
  texture.width = 512;
  texture.height = 512;
  const ground = texture.getContext('2d');
  for (let y=0;y<512;y+=16) for(let x=0;x<512;x+=16) {
    ground.fillStyle=((x+y)/16)%2?'#386956':'#3d735b';
    ground.fillRect(x,y,16,16);
  }
  function trackStroke(width,color,dash=[]) {
    ground.strokeStyle=color;ground.lineWidth=width;ground.setLineDash(dash);
    ground.beginPath();
    route.forEach(([x,y],i)=>i?ground.lineTo(256+x,256+y):ground.moveTo(256+x,256+y));
    ground.closePath();ground.stroke();
  }
  trackStroke(62,'#fff0cc');
  trackStroke(62,'#ef735f',[9,9]);
  trackStroke(54,'#515268');
  trackStroke(1,'#9d97a3',[8,12]);
  for(let row=0;row<9;row++) for(let col=0;col<2;col++) {
    ground.fillStyle=(row+col)%2?'#292638':'#fff4db';
    ground.fillRect(250+col*6,380+row*6,6,6);
  }
  const pixels = new Uint32Array(ground.getImageData(0,0,512,512).data.buffer);
  const floor = document.createElement('canvas');
  floor.width=240;floor.height=95;
  const floorContext=floor.getContext('2d');
  const floorImage=floorContext.createImageData(240,95);
  const floorPixels=new Uint32Array(floorImage.data.buffer);
  const depths=Array.from({length:95},(_,row)=>2800/(row+.5));

  function drawGround(cameraX,cameraY,fx,fy,rx,ry) {
    let index=0;
    for(const depth of depths) {
      const step=depth/112;
      const dx=rx*step,dy=ry*step;
      let wx=256+cameraX+fx*depth-119.5*dx;
      let wy=256+cameraY+fy*depth-119.5*dy;
      for(let col=0;col<240;col++) {
        floorPixels[index++]=pixels[((Math.floor(wy)&511)*512)+(Math.floor(wx)&511)];
        wx+=dx;wy+=dy;
      }
    }
    floorContext.putImageData(floorImage,0,0);
    ctx.imageSmoothingEnabled=false;
    ctx.drawImage(floor,0,40);
  }


  function renderView(driver, x, y, w, h) {
    ctx.save();
    ctx.translate(x,y);
    ctx.beginPath();ctx.rect(0,0,w,h);ctx.clip();
    ctx.scale(w/240,h/135);
    const horizon=40;
    ctx.fillStyle='#776aa4';ctx.fillRect(0,0,240,horizon);
    ctx.fillStyle='#f6bc88';ctx.fillRect(0,28,240,12);
    ctx.fillStyle='#ffe3a7';ctx.fillRect(172,10,20,20);
    ctx.fillStyle='#315c50';ctx.fillRect(0,horizon,240,95);
    const fx=Math.cos(driver.heading),fy=Math.sin(driver.heading);
    const rx=-fy,ry=fx;
    const cameraX=driver.x-fx*44,cameraY=driver.y-fy*44;
    function project(d) {
      const dx=d.x-cameraX,dy=d.y-cameraY;
      const z=dx*fx+dy*fy;
      const scale=112/Math.max(5,z);
      return [120+(dx*rx+dy*ry)*scale,horizon+25*scale,z,scale];
    }
    drawGround(cameraX,cameraY,fx,fy,rx,ry);
    for(const slick of slicks) {
      const [sx,sy,z,scale]=project(slick);
      if(z<9) continue;
      ctx.fillStyle='#252037';ctx.beginPath();
      ctx.ellipse(sx,sy,8*scale,2.5*scale,0,0,lapLength);ctx.fill();
    }
    function kart(d,sx,sy,s) {
      ctx.save();ctx.translate(Math.round(sx),Math.round(sy));ctx.scale(s,s);
      ctx.fillStyle='#232333';ctx.fillRect(-14,-5,28,10);
      ctx.fillStyle=d.face.color;ctx.fillRect(-11,-7,22,9);
      ctx.save();ctx.translate(-11,-26);ctx.scale(.22,.22);
      ctx.beginPath();d.face.points.forEach(([px,py],i)=>i?ctx.lineTo(px,py):ctx.moveTo(px,py));
      ctx.closePath();ctx.fill();ctx.strokeStyle='#241c32';ctx.lineWidth=5;ctx.stroke();
      ctx.fillStyle='#241c32';ctx.fillRect(35,42,8,12);ctx.fillRect(56,40,8,12);
      ctx.beginPath();ctx.moveTo(40,59);ctx.quadraticCurveTo(51,75,62,57);ctx.stroke();
      ctx.restore();ctx.restore();
    }
    grid.filter(d=>d!==driver).map(d=>({d,p:project(d)})).filter(({p})=>p[2]>36).sort((a,b)=>b.p[2]-a.p[2]).forEach(({d,p})=>kart(d,p[0],p[1],Math.min(1.3,p[3]*.44)));
    kart(driver,120,104,1.15);
    ctx.fillStyle='#211b30';ctx.fillRect(5,5,77,15);ctx.fillRect(182,5,53,32);
    ctx.fillStyle='#fff4db';ctx.font='bold 8px monospace';
    ctx.fillText('P'+driver.player.slot+'  LAP '+Math.min(laps,driver.lap+1)+'/'+laps,10,15);
    ctx.strokeStyle='#b8b0c5';ctx.lineWidth=1;ctx.beginPath();
    route.forEach(([x,y],i)=>i?ctx.lineTo(208+x*.11,21+y*.078):ctx.moveTo(208+x*.11,21+y*.078));
    ctx.closePath();ctx.stroke();
    if(performance.now()<driver.recoverUntil) {
      ctx.fillStyle='#fff4db';ctx.fillText('BACK ON TRACK',84,78);
    }
    for(const d of [...grid.filter(d=>d!==driver),driver]) {
      ctx.fillStyle=d.face.color;ctx.beginPath();
      ctx.arc(208+d.x*.11,21+d.y*.078,d===driver?3:2,0,lapLength);ctx.fill();
    }
    ctx.restore();
  }
  function render() {
    const targetHeight=grid.length===2?400:270;
    if(canvas.height!==targetHeight) canvas.height=targetHeight;
    ctx.fillStyle='#181724';ctx.fillRect(0,0,canvas.width,canvas.height);
    const columns=grid.length>2?2:1;
    const rows=grid.length>1?2:1;
    const width=canvas.width/columns,height=canvas.height/rows;
    grid.forEach((driver,i)=>renderView(driver,i%columns*width,Math.floor(i/columns)*height,width-2,height-2));
  }
  function tick(now) {
    const dt = Math.min(.06,(now-previous)/1000);
    previous = now;
    if (phase === 'countdown') {
      const signal = String(Math.max(1,Math.ceil((startAt-now)/1000)));
      if (signal!==lastSignal) {lastSignal=signal; Jam.sound.beep(420,100);get('signal').textContent=signal;}
      if (now>=startAt) {setPhase('playing');Jam.sound.beep(780,180);}
    }
    if (phase === 'playing') {
      get('signal').textContent = now<startAt+650?'GO!':'';
      slicks=slicks.filter(slick=>now<slick.until);
      for (const d of grid) {
        if (d.finished) continue;
        const input = now<d.inputUntil ? d.input : {};
        if(now<d.recoverUntil) continue;
        const boosting=now<d.boostUntil;
        const slowed=now<d.slowUntil;
        const cap=(boosting?180:145)*(slowed?.62:1);
        d.speed=Kart.clamp(d.speed+(input.gas?(boosting?220:125):-95)*dt,0,cap);
        const heading=d.heading+(input.steer||0)*2.55*Math.min(1,d.speed/55)*dt;
        const x=d.x+Math.cos(heading)*d.speed*dt,y=d.y+Math.sin(heading)*d.speed*dt;
        const position=nearest(x,y);
        if(position.distance>27) {
          d.speed=0;
          const center=nearest(d.x,d.y);
          Object.assign(d,{x:center.x,y:center.y,heading:center.heading});
          d.recoverUntil=now+450;
          Jam.sound.beep(150,100);
          continue;
        }
        const hit=slicks.findIndex(slick=>slick.owner!==d && Math.hypot(x-slick.x,y-slick.y)<11);
        if(hit>=0) {
          slicks.splice(hit,1);
          d.slowUntil=Math.max(d.slowUntil,now+1800);
          Jam.sound.beep(170,100);
        }
        const delta=position.progress-d.progress;
        d.total+=delta>.5?delta-1:delta<-.5?delta+1:delta;
        Object.assign(d,{x,y,heading,progress:position.progress});
        const lap=Math.floor(Math.max(0,d.total));
        if (lap>d.lap) {d.lap=lap;Jam.sound.beep(580,75);}
        if (lap>=laps) {
          d.finished=now;
          if (!finishAt) {finishAt=now;Jam.sound.beep(920,250);}
        }
      }
      if (grid.every(d=>d.finished) || (finishAt && now-finishAt>12000) || now-startAt>90000) {
        setPhase('over');
        get('again').hidden=false;
      }
    }
    if (phase !== 'lobby') {
      render();
      const ordered = [...grid].sort((a,b)=>(a.finished||Infinity)-(b.finished||Infinity) || b.total-a.total);
      get('standings').textContent=ordered.map((d,i)=>(i+1)+'. P'+d.player.slot+'  '+(d.finished?'FINISHED':'LAP '+Math.min(laps,d.lap+1)+'/'+laps)).join('   /   ');
      if (phase==='over') get('signal').textContent=ordered[0]?.finished?'P'+ordered[0].player.slot+' WINS':'TIME UP';
    }
    requestAnimationFrame(tick);
  }
  lineup();
  requestAnimationFrame(tick);
})();




