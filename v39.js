// Alien Planet Defense v39
// Dynamic threat scaling: horde size and frequency now respond to the amount of
// friendly units and infrastructure currently on the map.
document.title='Alien Planet Defense v39';

(function installV39DynamicThreatScaling(){
  const V39={
    UNIT_WEIGHT:1.0,
    BUILDING_WEIGHT:.90,
    CONSTRUCTION_WEIGHT:.55,
    WALL_SEGMENT_WEIGHT:.12,
    MAX_WALL_THREAT:6,
    SIZE_PER_THREAT:.032,
    MAX_SIZE_BONUS:1.35,
    MAX_HORDE_SIZE:220,
    FREQUENCY_PER_THREAT:.018,
    MAX_FREQUENCY_BONUS:.45
  };

  function v39ForceSnapshot(){
    let units=0,buildings=0,construction=0,walls=0;
    for(const u of state.units||[])if((Number(u.hp)||0)>0)units++;
    for(const s of state.structures||[]){
      if((Number(s.hp)||0)<=0)continue;
      if(s.type==='wall'){walls++;continue;}
      if(s.built===false)construction++;else buildings++;
    }
    const wallThreat=Math.min(V39.MAX_WALL_THREAT,walls*V39.WALL_SEGMENT_WEIGHT);
    const threat=units*V39.UNIT_WEIGHT+buildings*V39.BUILDING_WEIGHT+construction*V39.CONSTRUCTION_WEIGHT+wallThreat;
    return{units,buildings,construction,walls,threat};
  }

  function v39Scaling(){
    const snap=v39ForceSnapshot();
    const sizeBonus=Math.min(V39.MAX_SIZE_BONUS,snap.threat*V39.SIZE_PER_THREAT);
    const frequencyBonus=Math.min(V39.MAX_FREQUENCY_BONUS,snap.threat*V39.FREQUENCY_PER_THREAT);
    return{
      ...snap,
      sizeMultiplier:1+sizeBonus,
      frequencyMultiplier:1+frequencyBonus
    };
  }

  const v38UpdateDirectorV39=updateDirector;
  updateDirector=function(dt){
    if(!state.v38Director)return v38UpdateDirectorV39(dt);
    const d=state.v38Director;
    const beforeHorde=d.hordeNo||0;
    const beforeQueue=d.queue||0;
    const scale=v39Scaling();

    // Keep the first preparation window unchanged. After that, a larger army/base
    // makes the recovery timer tick faster, but even a huge force only shortens
    // the v38 gap by about 31% (1 / 1.45), preserving distinct horde downtime.
    const timerScale=(d.queue<=0&&beforeHorde>0)?scale.frequencyMultiplier:1;
    v38UpdateDirectorV39(dt*timerScale);

    // v38 creates the new horde at the end of its idle timer, then begins batching
    // it on the following update. That gives us one deterministic point to scale
    // the full wave before any member is spawned.
    if((d.hordeNo||0)>beforeHorde&&(d.queue||0)>0&&beforeQueue<=0){
      const launched=v39Scaling();
      const baseSize=d.queue;
      d.queue=Math.min(V39.MAX_HORDE_SIZE,Math.max(baseSize,Math.round(baseSize*launched.sizeMultiplier)));
      d.v39ThreatAtLaunch=launched.threat;
      d.v39UnitsAtLaunch=launched.units;
      d.v39BuildingsAtLaunch=launched.buildings+launched.construction;
      d.v39SizeMultiplier=launched.sizeMultiplier;
      d.v39FrequencyMultiplier=launched.frequencyMultiplier;
      state.v39LastThreat=launched;
    }
  };

  const v38ResetV39=reset;
  reset=function(){
    v38ResetV39();
    state.v39LastThreat=v39Scaling();
    if(typeof updateHud==='function')updateHud();
  };
  if(els?.restart)els.restart.onclick=reset;

  if(state)state.v39LastThreat=v39Scaling();

  const guide=document.querySelector('#guidePanel .guide-grid');
  if(guide&&!document.getElementById('v39ThreatGuide')){
    const d=document.createElement('div');d.className='guide-box';d.id='v39ThreatGuide';
    d.innerHTML='<b>Adaptive Horde Threat</b><p>The alien director now reacts to how much you have deployed. More movable units and more buildings increase the next horde size and shorten the recovery gap. Buildings under construction count less, while Wall segments contribute only a small capped amount so long walls cannot cause runaway scaling. The first horde delay remains unchanged so the opening still has setup time.</p>';
    guide.appendChild(d);
  }
})();
