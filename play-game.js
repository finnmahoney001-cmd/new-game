(function () {
  const controls = document.querySelector('#controls');
  let phase='lobby', round=0, face=Kart.face(null,'#ff8c6e'), ready=false, drag=null;
  let ability="pulse", cooldownUntil=0;
  const held=new Map();
  let tilt=false, neutral=null, steer=0, tiltTimer;
  function tiltStatus(message) {
    controls.querySelector('#tilt-status').textContent=message;
  }
  function setTilt(enabled) {
    tilt=enabled;
    neutral=null;
    steer=0;
    clearTimeout(tiltTimer);
    held.clear();
    controls.classList.toggle('tilt-mode',tilt);
    controls.querySelector('#steering-mode').textContent=tilt?'Use buttons':'Use tilt';
    drive();
  }
  async function toggleTilt() {
    if(tilt) {setTilt(false);tiltStatus('Button steering');return;}
    if(!window.isSecureContext || !window.DeviceOrientationEvent) {
      tiltStatus('Tilt needs a supported phone browser and an HTTPS link.');
      return;
    }
    try {
      if(typeof DeviceOrientationEvent.requestPermission==='function' &&
         await DeviceOrientationEvent.requestPermission()!=='granted') {
        tiltStatus('Motion access was denied. You can still use the buttons.');
        return;
      }
      setTilt(true);
      tiltStatus('Hold your phone in a comfortable position to calibrate.');
      tiltTimer=setTimeout(()=>{
        if(neutral===null) {setTilt(false);tiltStatus('No motion signal. Button steering is active.');}
      },2500);
    } catch {
      tiltStatus('Motion access is unavailable. Button steering is active.');
    }
  }
  window.addEventListener('deviceorientation',event=>{
    if(!tilt || !Number.isFinite(event.gamma)) return;
    if(neutral===null) {
      neutral=event.gamma;
      tiltStatus('Tilt left or right to steer.');
    }
    const difference=event.gamma-neutral;
    steer=Math.abs(difference)<4?0:Kart.clamp(difference/25,-1,1);
  });
  const me=Jam.join({
    onReady(player) {
      if(player.role!=='player') {controls.textContent='Spectating. Watch the big screen.';return;}
      face=Kart.face(null,player.color);
      build();
    },
    onMessage(type,data) {
      if(type==='cooldown') {cooldownUntil=performance.now()+data;updateAbility();return;}
      if(type!=='phase' || !controls.querySelector('#editor')) return;
      const changed=phase!==data.name || round!==data.round;
      phase=data.name;round=data.round;
      if(changed) {held.clear();cooldownUntil=performance.now()+(data.cooldown||0);}
      if(data.ability && (changed || phase!=='lobby')) ability=data.ability;
      if(phase==='lobby' && changed) {
        ready=!!data.ready;
        if(data.face) face=Kart.face(data.face,face.color);
      }
      update();
    },
    onScreenLost() {held.clear();controls.querySelector('#status')?.replaceChildren('Waiting for the race screen…');}
  });
  function sendFace() {me.send('driver',{round,face,ready,ability});}
  function drive() {
    if(phase!=='playing') return;
    const values=[...held.values()];
    me.send('drive',{round,gas:values.includes('gas'),steer:tilt?steer:Number(values.includes('right'))-Number(values.includes('left'))});
  }
  function build() {
    controls.innerHTML='<p id="status"></p><button id="steering-mode" type="button">Use tilt</button><p id="tilt-status" aria-live="polite"></p><section id="editor"><svg id="face" viewBox="0 0 100 100" aria-label="Drag eight points to shape your driver"></svg>'+
      '<label class="paint">Face color <input id="paint" type="color"></label><label>Ability <select id="ability-choice"></select></label><p id="ability-description"></p><button id="ready">Ready</button></section>'+
      '<div id="pedals" hidden><button data-key="left" aria-label="Steer left">◀</button><button data-key="gas">GAS</button><button data-key="right" aria-label="Steer right">▶</button><button id="ability-use" type="button"></button></div>';
    controls.querySelector('#steering-mode').onclick=toggleTilt;
    const choice=controls.querySelector('#ability-choice');
    for(const [id,entry] of Object.entries(Kart.abilities)) choice.add(new Option(entry.name,id));
    choice.onchange=()=>{ability=choice.value;sendFace();update();};
    controls.querySelector('#ability-use').onclick=useAbility;
    const svg=controls.querySelector('#face');
    svg.onpointerdown=e=>{
      const handle=e.target.closest('[data-point]');
      if(!handle || ready || drag) return;
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
    controls.querySelectorAll('[data-key]').forEach(button=>{
      button.onpointerdown=e=>{
        e.preventDefault();
        button.setPointerCapture(e.pointerId);
        held.set(e.pointerId,button.dataset.key);
        drive();
      };
      button.onpointerup=button.onpointercancel=button.onlostpointercapture=e=>{
        if(held.delete(e.pointerId)) drive();
      };
    });
    update();
  }
  function preview() {
    controls.querySelector('#face').innerHTML=Kart.avatar(face)+face.points.map(([x,y],i)=>
      '<circle data-point="'+i+'" cx="'+x+'" cy="'+y+'" r="5" fill="#fff4db" stroke="#292436" stroke-width="1.6"/>').join('');
  }
  function update() {
    controls.querySelector('#status').textContent={
      lobby:ready?'Ready for the race':'Drag the eight points to shape your driver.',
      countdown:'Get ready…',playing:'Hold GAS and steer through each bend.',over:'Race over. See the big screen.'
    }[phase];
    controls.querySelector('#editor').hidden=phase!=='lobby';
    controls.querySelector('#pedals').hidden=phase!=='playing';
    controls.querySelector('#paint').value=face.color;
    controls.querySelector('#paint').disabled=ready;
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
  const keys={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'gas',' ':'gas'};
  window.addEventListener('keydown',e=>{
    if(e.key.toLowerCase()==='e' && !e.repeat) useAbility();
    if(phase==='playing' && keys[e.key]) {e.preventDefault();if(!e.repeat){held.set(e.key,keys[e.key]);drive();}}
  });
  window.addEventListener('keyup',e=>{if(held.delete(e.key)) drive();});
  window.addEventListener('blur',()=>{held.clear();drive();});
  setInterval(()=>{if(held.size || tilt) drive();},240);
})();

