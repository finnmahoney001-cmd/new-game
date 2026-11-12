(function () {
  const controls = document.querySelector('#controls');
  let phase='lobby', round=0, face=Kart.face(null,'#ff8c6e'), ready=false, drag=null;
  let ability="pulse", cooldownUntil=0;
  const presets={
    Round:[[50,8],[80,16],[94,43],[87,72],[65,91],[32,91],[10,73],[7,39]],
    Square:[[41,20],[85,20],[90,43],[90,76],[65,85],[25,85],[7,77],[7,33]],
    Tall:[[50,5],[67,10],[79,39],[74,74],[58,94],[38,94],[24,73],[22,39]],
    Wide:[[50,22],[84,27],[98,44],[92,61],[68,76],[29,76],[5,61],[3,41]]
  };
  let headShape='Round', customPoints=face.points;
  const held=new Map();
  let swapped=false;
  try { swapped=localStorage.getItem('face-circuit-swap')==='true'; } catch {}
  function showLayout() {
    controls.classList.toggle('swapped',swapped);
    controls.querySelector('#steering-mode').textContent=swapped?'Swap sides · Stick on right':'Swap sides · Stick on left';
  }
  const me=Jam.join({
    onReady(player) {
      if(player.role!=='player') {controls.textContent='Spectating. Watch the big screen.';return;}
      face=Kart.face({points:presets.Round},player.color);
      build();
    },
    onMessage(type,data) {
      if(type==='cooldown') {cooldownUntil=performance.now()+data;updateAbility();return;}
      if(type!=='phase' || !controls.querySelector('#editor')) return;
      const changed=phase!==data.name || round!==data.round;
      phase=data.name;round=data.round;
      if(changed) {held.clear();showStick();cooldownUntil=performance.now()+(data.cooldown||0);}
      if(data.ability && (changed || phase!=='lobby')) ability=data.ability;
      if(phase==='lobby' && changed) {
        ready=!!data.ready;
        if(data.face) face=Kart.face(data.face,face.color);
      }
      update();
    },
    onScreenLost() {held.clear();showStick();controls.querySelector('#status')?.replaceChildren('Waiting for the race screen…');}
  });
  function sendFace() {me.send('driver',{round,face,ready,ability});}
  function drive() {
    showStick();
    if(phase!=='playing') return;
    const values=[...held.values()];
    const stick=values.find(value=>typeof value==='object');
    me.send('drive',{round, throttle:stick?.y ?? (Number(values.includes('gas'))-Number(values.includes('reverse'))),
      steer:stick?.x ?? (Number(values.includes('right'))-Number(values.includes('left')))});
  }
  function showStick() {
    const value=[...held.values()].find(value=>typeof value==='object') ?? {x:0,y:0};
    const knob=controls.querySelector('.stick-knob');
    knob?.style.setProperty('--shift',value.x*36+'px');
    knob?.style.setProperty('--rise',-value.y*36+'px');
  }
  function build() {
    controls.innerHTML='<p id="status"></p><button id="steering-mode" type="button">Swap sides</button><section id="editor"><label>Head shape <select id="head-shape"><option>Round</option><option>Square</option><option>Tall</option><option>Wide</option><option>Make your own</option></select></label><svg id="face" viewBox="0 0 100 100" aria-label="Drag eight points to shape your driver"></svg>'+
      '<label class="paint">Face color <input id="paint" type="color"></label><label>Ability <select id="ability-choice"></select></label><p id="ability-description"></p><button id="ready">Ready</button></section>'+
      '<div id="pedals" hidden><div class="steering" aria-label="Driving joystick"><span class="stick-knob"></span></div><button id="ability-use" type="button"></button></div>';
    const choice=controls.querySelector('#ability-choice');
    for(const [id,entry] of Object.entries(Kart.abilities)) choice.add(new Option(entry.name,id));
    choice.onchange=()=>{ability=choice.value;sendFace();update();};
    controls.querySelector('#ability-use').onclick=useAbility;
    controls.querySelector('#steering-mode').onclick=()=>{
      swapped=!swapped;
      held.clear();showStick();
      drive();
      showLayout();
      try { localStorage.setItem('face-circuit-swap',String(swapped)); } catch {}
    };
    showLayout();
    const shape=controls.querySelector('#head-shape');
    shape.onchange=()=>{
      if(headShape==='Make your own') customPoints=face.points;
      headShape=shape.value;
      face=Kart.face({color:face.color,points:presets[headShape]||customPoints},face.color);
      sendFace();
      update();
    };
    const svg=controls.querySelector('#face');
    svg.onpointerdown=e=>{
      const handle=e.target.closest('[data-point]');
      if(!handle || ready || drag || headShape!=='Make your own') return;
      drag={index:Number(handle.dataset.point),id:e.pointerId};
      svg.setPointerCapture(e.pointerId);
    };
    svg.onpointermove=e=>{
      if(!drag || e.pointerId!==drag.id) return;
      const point=new DOMPoint(e.clientX,e.clientY).matrixTransform(svg.getScreenCTM().inverse());
      face.points[drag.index]=[point.x,point.y];
      face=Kart.face(face,face.color);
      preview();
    };
    svg.onpointerup=svg.onpointercancel=svg.onlostpointercapture=e=>{
      if(drag?.id===e.pointerId) {drag=null;sendFace();}
    };
    controls.querySelector('#paint').oninput=e=>{
      face.color=e.target.value;preview();sendFace();
    };
    controls.querySelector('#ready').onclick=()=>{ready=!ready;sendFace();update();};
    const pedals=controls.querySelector('#pedals');
    for(const event of ['selectstart','contextmenu','dragstart']) {
      pedals.addEventListener(event,e=>e.preventDefault());
    }
    controls.querySelectorAll('[data-key],.steering').forEach(button=>{
      const setInput=(id,x,y)=>{
        const bounds=button.getBoundingClientRect();
        const dx=(x-bounds.left-bounds.width/2)/36;
        const dy=(bounds.top+bounds.height/2-y)/36;
        const length=Math.hypot(dx,dy);
        const scale=length<.14?0:1/Math.max(1,length);
        held.set(id,{x:dx*scale,y:dy*scale});
      };
      {
        button.addEventListener('touchmove',e=>{
          e.preventDefault();
          for(const touch of e.changedTouches) {
            const id='touch:'+touch.identifier;
            if(held.has(id)) setInput(id,touch.clientX,touch.clientY);
          }
          drive();
        },{passive:false});
        button.onpointermove=e=>{
          if(!held.has(e.pointerId)) return;
          setInput(e.pointerId,e.clientX,e.clientY);
          drive();
        };
      }
      // Track each finger independently on mobile Safari.
      button.addEventListener('touchstart',e=>{
        e.preventDefault();
        for(const touch of e.changedTouches) setInput('touch:'+touch.identifier,touch.clientX,touch.clientY);
        drive();
      },{passive:false});
      for(const type of ['touchend','touchcancel']) {
        button.addEventListener(type,e=>{
          for(const touch of e.changedTouches) held.delete('touch:'+touch.identifier);
          drive();
        });
      }
      button.onpointerdown=e=>{
        if(e.pointerType==='touch') return;
        e.preventDefault();
        button.setPointerCapture(e.pointerId);
        setInput(e.pointerId,e.clientX,e.clientY);
        drive();
      };
      button.onpointerup=button.onpointercancel=button.onlostpointercapture=e=>{
        if(held.delete(e.pointerId)) drive();
      };
    });
    update();
  }
  function preview() {
    controls.querySelector('#face').innerHTML=Kart.avatar(face)+(headShape==='Make your own'?face.points.map(([x,y],i)=>
      '<circle data-point="'+i+'" cx="'+x+'" cy="'+y+'" r="5" fill="#fff4db" stroke="#292436" stroke-width="1.6"/>').join(''):'');
  }
  function update() {
    controls.querySelector('#status').textContent={
      lobby:ready?'Ready for the race':headShape==='Make your own'?'Drag the eight points to shape your driver.':'Choose a head shape and color.',
      countdown:'Get ready…',playing:'Drag up to drive, down to reverse, and sideways to steer.',over:'Race over. See the big screen.'
    }[phase];
    controls.querySelector('#editor').hidden=phase!=='lobby';
    controls.querySelector('#pedals').hidden=phase!=='playing';
    controls.querySelector('#paint').value=face.color;
    controls.querySelector('#paint').disabled=ready;
    controls.querySelector('#head-shape').disabled=ready;
    controls.querySelector('#ready').textContent=ready?'Edit driver':'Ready';
    const choice=controls.querySelector('#ability-choice');
    choice.value=ability;
    choice.disabled=ready;
    const entry=Kart.abilities[ability];
    controls.querySelector('#ability-description').textContent=entry.description+' Cooldown: '+entry.cooldown/1000+'s.';
    preview();
    updateAbility();
  }
  function useAbility() {
    if(phase==='playing' && performance.now()>=cooldownUntil) me.send('ability',{round});
  }
  function updateAbility() {
    const button=controls.querySelector('#ability-use');
    if(!button) return;
    const seconds=Math.max(0,Math.ceil((cooldownUntil-performance.now())/1000));
    button.disabled=phase!=='playing' || seconds>0;
    button.textContent=Kart.abilities[ability].name+(seconds?' · '+seconds+'s':'');
  }
  setInterval(updateAbility,200);
  const keys={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'gas',ArrowDown:'reverse',' ':'gas'};
  window.addEventListener('keydown',e=>{
    if(e.key.toLowerCase()==='e' && !e.repeat) useAbility();
    if(phase==='playing' && keys[e.key]) {e.preventDefault();if(!e.repeat){held.set(e.key,keys[e.key]);drive();}}
  });
  window.addEventListener('keyup',e=>{if(held.delete(e.key)) drive();});
  window.addEventListener('blur',()=>{held.clear();showStick();drive();});
  setInterval(()=>{if(held.size) drive();},240);
})();

