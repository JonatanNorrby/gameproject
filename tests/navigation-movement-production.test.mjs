import test from 'node:test';
import assert from 'node:assert/strict';
import { installLegacyNavigationMovementBridge } from '../js/migration/navigationMovementLegacyBridge.js';
import { getUnitConfig } from '../js/units/unitConfig.js';
import { buildEffectiveMovementSpeedMap, updateMovementRuntime } from '../js/movement/runtime.js';
import { createGameConfig } from '../js/core/config.js';

function unit(role,x=1000,y=1000,id=`${role}-${Math.random()}`){
  const config=getUnitConfig(role);
  return {
    id,type:config.runtimeType,role,x,y,
    hp:config.maxHp,maxHp:config.maxHp,
    path:[],moveTarget:null,heading:0,
    platoonId:null,platoonSlot:0,
    attachedTo:null,attachSlot:0,
    garrisonedIn:null,transportedIn:null,
  };
}

function legacyState(){
  return {
    units:[],structures:[],terrain:[],depots:[],rivers:[],
    mods:{unitMove:1},v47MedicAttachMode:false,v47ApcAttachMode:false,
  };
}

function fakeHost(getState){
  let owners=null,audit=null;
  return {
    baseX:5060,baseY:3795,baseRadius:68,getState,
    installOwners(value){owners=value;return()=>{};},
    markReady(value){audit=value;},
    get owners(){return owners;},
    get audit(){return audit;},
  };
}

function cleanGame(state){
  const config=createGameConfig();
  return {
    config,
    state:{
      base:{x:5060,y:3795,radius:68},
      entities:{
        units:state.units,structures:state.structures,terrain:state.terrain,
        depots:state.depots,rivers:state.rivers,
      },
      modifiers:{unitMove:state.mods.unitMove},
      commands:{medicFollowAttachMode:false,apcSupportAttachMode:false},
    },
  };
}

test('Step 2 bridge installs one clean owner for navigation, destination, movement and manual orders',()=>{
  let state=legacyState();
  const rifle=unit('rifleman',1000,1000,'rifle');
  state.units.push(rifle);
  const host=fakeHost(()=>state);
  const result=installLegacyNavigationMovementBridge(host);

  assert.equal(result.audit.active,true);
  assert.match(result.audit.owner,/js\/navigation/);
  assert.equal(result.audit.asyncManualMoveBridge,false);
  for(const key of ['navPointBlocked','findPath','setUnitDestination','updateUnitMovement','manualMove'])assert.equal(typeof host.owners[key],'function');

  assert.equal(host.owners.setUnitDestination(rifle,1300,1000),true);
  host.owners.updateUnitMovement(.1);
  assert.ok(Math.abs(rifle.x-1016.5)<1e-9);
  assert.equal(host.audit.id,'navigation-movement-step2');
});

test('Step 2 bridge follows a replaced legacy state object after Restart',()=>{
  let state=legacyState();
  const host=fakeHost(()=>state);
  installLegacyNavigationMovementBridge(host);

  const first=unit('rifleman',1000,1200,'first');
  state.units=[first];
  assert.equal(host.owners.setUnitDestination(first,1300,1200),true);
  host.owners.updateUnitMovement(.1);
  assert.ok(first.x>1000);

  state=legacyState();
  const replacement=unit('truck',1200,1500,'replacement');
  state.units=[replacement];
  assert.equal(host.owners.setUnitDestination(replacement,1500,1500),true);
  host.owners.updateUnitMovement(.1);
  assert.ok(replacement.x>1200);
  assert.equal(first.x<1300,true,'old state is no longer advanced');
});

test('manual move owner routes a Platoon through clean commands and cancels Truck route ownership',()=>{
  let state=legacyState();
  const truck=unit('truck',1000,1800,'truck');
  const rifle=unit('rifleman',1040,1800,'rifle');
  truck.platoonId=rifle.platoonId='p1';
  truck.routeLoop=true;truck.routeActive=true;truck.routePendingStart=true;truck.routeInTransit=true;
  state.units=[truck,rifle];
  const host=fakeHost(()=>state);
  installLegacyNavigationMovementBridge(host);

  const result=host.owners.manualMove(truck,1500,1800);
  assert.equal(result.ok,true);
  assert.equal(result.kind,'platoon');
  assert.equal(result.ordered,2);
  assert.equal(truck.routeLoop,false);
  assert.equal(truck.routeActive,false);
  assert.equal(truck.routePendingStart,false);
  assert.equal(truck.routeInTransit,false);
  assert.ok(truck.path.length>0);
  assert.ok(rifle.path.length>0);
});

test('production movement preserves slowest-member Platoon speed',()=>{
  const state=legacyState();
  const rifle=unit('rifleman',1000,2200,'rifle');
  const heavy=unit('heavygunner',1000,2260,'heavy');
  rifle.platoonId=heavy.platoonId='p2';
  rifle.path=[{x:1500,y:2200}];rifle.moveTarget={x:1500,y:2200};
  heavy.path=[{x:1500,y:2260}];heavy.moveTarget={x:1500,y:2260};
  state.units=[rifle,heavy];
  const game=cleanGame(state);

  const speeds=buildEffectiveMovementSpeedMap(game);
  assert.equal(speeds.get(rifle.id),155);
  assert.equal(speeds.get(heavy.id),155);
  updateMovementRuntime(game,.1);
  assert.ok(Math.abs(rifle.x-1015.5)<1e-9);
  assert.ok(Math.abs(heavy.x-1015.5)<1e-9);
});

test('APC support speed boost keeps the legacy 28% boost with APC escort cap',()=>{
  const state=legacyState();
  const heavy=unit('heavygunner',1300,2600,'heavy');
  const apc=unit('apc',1200,2600,'apc');
  apc.v47SupportUnitId=heavy.id;
  apc.v47SupportPlatoonId=null;
  apc.passengerId=null;
  state.units=[heavy,apc];
  const game=cleanGame(state);

  const speeds=buildEffectiveMovementSpeedMap(game);
  assert.ok(Math.abs(speeds.get(heavy.id)-161.68)<1e-9);
  assert.equal(speeds.get(apc.id),172);
});

test('transported infantry stays inside a moving APC and does not run its own path',()=>{
  const state=legacyState();
  const apc=unit('apc',1000,3000,'apc');
  const passenger=unit('rifleman',1000,3000,'passenger');
  apc.passengerId=passenger.id;
  passenger.transportedIn=apc.id;
  apc.path=[{x:1500,y:3000}];apc.moveTarget={x:1500,y:3000};
  passenger.path=[{x:500,y:3000}];passenger.moveTarget={x:500,y:3000};
  state.units=[apc,passenger];
  const game=cleanGame(state);

  updateMovementRuntime(game,.1);
  assert.ok(apc.x>1000);
  assert.deepEqual({x:passenger.x,y:passenger.y},{x:apc.x,y:apc.y});
  assert.deepEqual(passenger.path,[]);
  assert.equal(passenger.moveTarget,null);
});

test('Truck escort attachment follows the Truck and cannot advance an independent path',()=>{
  const state=legacyState();
  const truck=unit('truck',1800,3300,'truck');
  truck.heading=Math.PI/2;
  const escort=unit('rifleman',1000,1000,'escort');
  escort.attachedTo=truck.id;escort.attachSlot=0;
  escort.path=[{x:9000,y:7000}];escort.moveTarget={x:9000,y:7000};
  state.units=[truck,escort];
  const game=cleanGame(state);

  updateMovementRuntime(game,.1);
  assert.ok(Math.abs(escort.x-(truck.x-28))<1e-9);
  assert.ok(Math.abs(escort.y-(truck.y-32))<1e-9);
  assert.deepEqual(escort.path,[]);
  assert.equal(escort.moveTarget,null);
});

test('Medic and APC support follow movement is issued by the clean movement runtime',()=>{
  const state=legacyState();
  const target=unit('rifleman',2200,3800,'target');
  target.heading=0;
  const medic=unit('medic',1500,3800,'medic');
  medic.v47FollowId=target.id;medic.v47FollowTimer=0;
  const apc=unit('apc',1400,4000,'apc');
  apc.v47SupportUnitId=target.id;apc.v47SupportTimer=0;apc.passengerId=null;
  state.units=[target,medic,apc];
  const game=cleanGame(state);

  const result=updateMovementRuntime(game,.1);
  assert.ok(result.supportOrders>=2);
  assert.ok(medic.path.length>0);
  assert.ok(apc.path.length>0);
  assert.ok(medic.v47FollowTimer>0);
  assert.ok(apc.v47SupportTimer>0);
});
