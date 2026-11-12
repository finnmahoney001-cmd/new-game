(function () {
  const base = [[50,12],[76,18],[89,43],[84,69],[62,86],[35,86],[14,68],[12,39]];
  const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
  function face(value, color) {
    return {
      color: /^#[0-9a-f]{6}$/i.test(value?.color) ? value.color : color,
      points: base.map(([x,y],i) => [x,y].map((n,j) => {
        const v = value?.points?.[i]?.[j];
        return Number.isFinite(v) ? clamp(v,n-10,n+10) : n;
      }))
    };
  }
  function avatar(f) {
    return '<polygon points="' + f.points.map(p=>p.join(',')).join(' ') + '" fill="' + f.color +
      '" stroke="#241c32" stroke-width="4" stroke-linejoin="round"/>' +
      '<ellipse cx="39" cy="47" rx="4" ry="6"/><ellipse cx="60" cy="45" rx="4" ry="6"/>' +
      '<path d="M40 59 Q51 75 62 57" fill="none" stroke="#241c32" stroke-width="4" stroke-linecap="round"/>';
  }
  const abilities = {
    pulse:{name:'Slow Pulse', cooldown:9000, description:'Slows nearby rivals for 1.5 seconds.'},
    boost:{name:'Turbo', cooldown:6500, description:'Increases your speed for 1 second.'},
    slick:{name:'Oil Slick', cooldown:11000, description:'Drops oil behind you that slows the first rival to hit it.'}
  };
  window.Kart = {face, avatar, clamp, abilities};
})();
