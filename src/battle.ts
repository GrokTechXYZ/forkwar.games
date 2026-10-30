import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createCombatRig, type RigPose } from './combat/models';
import { createCombatEffects } from './combat/effects';
import { makeEnvironment } from './environment';

export type BattleController = { setPaused(value:boolean):void; setCinema(value:boolean):void; dispose():void };
type Callbacks = { onTick(time:number):void; onImpact(kind:number):void; onUnavailable():void };

export function createBattle(host:HTMLElement, paused:boolean, callbacks:Callbacks):BattleController {
  const renderer = new THREE.WebGLRenderer({antialias:false,powerPreference:'high-performance',alpha:false});
  const mobile=matchMedia('(max-width:700px)').matches;
  renderer.setPixelRatio(Math.min(devicePixelRatio,mobile?1.25:1.5));
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
  host.append(renderer.domElement);
  const scene=new THREE.Scene();scene.background=new THREE.Color('#101211');scene.fog=new THREE.FogExp2('#101914',.021);
  const camera=new THREE.PerspectiveCamera(36,1,.1,140);
  scene.add(new THREE.HemisphereLight(0xc6d5b5,0x25231b,.9));
  const sun=new THREE.DirectionalLight(0xffd5a0,2.1);sun.position.set(-10,20,4);sun.castShadow=true;
  sun.shadow.mapSize.set(mobile?1024:2048,mobile?1024:2048);
  Object.assign(sun.shadow.camera,{left:-16,right:16,top:16,bottom:-16,near:1,far:65});
  sun.shadow.normalBias=.045;sun.shadow.bias=-.0001;scene.add(sun);
  const rim=new THREE.DirectionalLight(0x8bbaa7,2.3);rim.position.set(6,9,-12);scene.add(rim);
  const environment=makeEnvironment(scene);
  const composer=new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene,camera));
  const bloom=new UnrealBloomPass(new THREE.Vector2(1,1),.64,.55,1.05);composer.addPass(bloom);composer.addPass(new OutputPass());
  const kinds=['scout','striker','guardian','warden','drone','sentry'];
  const origins=[new THREE.Vector3(-5.2,0,-1.5),new THREE.Vector3(-4,0,2),new THREE.Vector3(-2.7,0,4.6),new THREE.Vector3(4.5,0,-2),new THREE.Vector3(5.6,0,1.2),new THREE.Vector3(3.2,0,4.4)];
  const rigs=kinds.map((kind,i)=>{const rig=createCombatRig(kind,i<3?'player':'enemy');scene.add(rig.root);return rig;});
  const joints=rigs.map(r=>{const list:{node:THREE.Object3D;rotation:THREE.Quaternion;position:THREE.Vector3}[]=[];r.root.traverse(n=>{if(n instanceof THREE.Group&&n!==r.root)list.push({node:n,rotation:n.quaternion.clone(),position:n.position.clone()});});return list;});
  const ringGeometry=new THREE.RingGeometry(.6,.63,48);
  const ringMaterials=[new THREE.MeshBasicMaterial({color:0x89cbb4,transparent:true,opacity:.3,depthWrite:false,side:THREE.DoubleSide}),new THREE.MeshBasicMaterial({color:0xd7a571,transparent:true,opacity:.25,depthWrite:false,side:THREE.DoubleSide})];
  const selection=rigs.map((_,i)=>{const ring=new THREE.Mesh(ringGeometry,ringMaterials[i<3?0:1]);ring.rotation.x=-Math.PI/2;scene.add(ring);return ring;});
  const effects=createCombatEffects();scene.add(effects.root);
  const returnEffects=createCombatEffects();scene.add(returnEffects.root);
  const distantEffects=createCombatEffects();scene.add(distantEffects.root);
  const impactLight=new THREE.PointLight(0xffbb70,0,13,2);scene.add(impactLight);
  const source=new THREE.Vector3(),target=new THREE.Vector3(),returnSource=new THREE.Vector3(),distantSource=new THREE.Vector3();
  const viewTarget=new THREE.Vector3(),pointer=new THREE.Vector2();
  let time=1.2,previous=performance.now(),frame=0,disposed=false,cinema=false,cinemaBlend=0,lastImpact=-1,needsFrame=true,width=1,height=1;
  let currentRatio=renderer.getPixelRatio(),slowFrames=0,renderedFrames=0,measuredFrames=0;
  const reduced=matchMedia('(prefers-reduced-motion:reduce)');
  const resize=()=>{
    width=host.clientWidth;height=host.clientHeight;if(width<1||height<1)return;
    renderer.setSize(width,height,false);composer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix();needsFrame=true;
  };
  const observer=new ResizeObserver(resize);observer.observe(host);resize();
  const onMove=(e:PointerEvent)=>{if(e.pointerType==='touch'||reduced.matches)return;const r=host.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width-.5,(e.clientY-r.top)/r.height-.5);needsFrame=true;};
  const onLeave=()=>pointer.set(0,0);
  const onLost=(e:Event)=>{e.preventDefault();cancelAnimationFrame(frame);callbacks.onUnavailable();};
  const onVisibility=()=>{previous=performance.now();if(!document.hidden&&!disposed){cancelAnimationFrame(frame);needsFrame=true;frame=requestAnimationFrame(render);}};
  document.addEventListener('pointermove',onMove,{passive:true});document.addEventListener('pointerleave',onLeave);document.addEventListener('visibilitychange',onVisibility);
  renderer.domElement.addEventListener('webglcontextlost',onLost);
  const smooth=(v:number)=>{const c=THREE.MathUtils.clamp(v,0,1);return c*c*(3-2*c);};
  const abilities=['fx-signal','fx-fire','fx-guard'];

  function render(now:number){
    if(disposed||document.hidden)return;
    const dt=Math.min((now-previous)/1000,.05);previous=now;
    if(!paused)time+=dt;
    const blendTarget=cinema?1:0;
    if(Math.abs(cinemaBlend-blendTarget)>.001){cinemaBlend=THREE.MathUtils.lerp(cinemaBlend,blendTarget,reduced.matches?1:Math.min(1,dt*2));needsFrame=true;}else cinemaBlend=blendTarget;
    if(paused&&!needsFrame){frame=requestAnimationFrame(render);return;}needsFrame=false;
    const loop=time%24,index=Math.floor(loop/8),local=loop%8;
    const actor=rigs[index],opponentIndex=index+3;
    const targetOrigin=origins[opponentIndex];
    let phase='idle',progress=0;
    if(local<1){phase='idle';progress=local;}
    else if(local<2.2){phase='advance';progress=(local-1)/1.2;}
    else if(local<3.15){phase='windup';progress=(local-2.2)/.95;}
    else if(local<3.9){phase='impact';progress=(local-3.15)/.75;}
    else if(local<4.5){phase='recover';progress=(local-3.9)/.6;}
    else if(local<5.7){phase='retreat';progress=(local-4.5)/1.2;}
    else{phase='idle';progress=(local-5.7)/2.3;}
    const advance=index===2?.74:.32;
    const travel=phase==='advance'?smooth(progress):['windup','impact','recover'].includes(phase)?1:phase==='retreat'?1-smooth(progress):0;
    const counter=local>6&&local<7.15;
    const secondary=(index+1)%3,secondaryTick=time%2.6,secondaryEnemy=Math.floor(time/2.6)%2===1;
    const secondaryActor=secondary+(secondaryEnemy?3:0),secondaryTarget=secondary+(secondaryEnemy?0:3);
    const secondaryPhase=secondaryTick<.45?'windup':secondaryTick<1.05?'impact':secondaryTick<1.5?'recover':'idle';
    const secondaryProgress=secondaryPhase==='windup'?secondaryTick/.45:secondaryPhase==='impact'?(secondaryTick-.45)/.6:secondaryPhase==='recover'?(secondaryTick-1.05)/.45:0;
    rigs.forEach((rig,i)=>{
      rig.root.position.copy(origins[i]);
      let pose:RigPose['phase']='idle',p=progress;
      if(i===index){
        rig.root.position.lerp(targetOrigin,travel*advance);
        pose=phase==='advance'||phase==='retreat'?'run':phase==='impact'?'attack':phase==='windup'?'windup':phase==='recover'?'recover':'idle';
        if(counter){pose='hit';p=(local-6)/1.15;}
      }else if(i>=3&&phase==='impact'&&(i===opponentIndex||index===1)){pose='hit';}
      else if(i===opponentIndex&&counter){pose='attack';p=(local-6)/1.15;}
      else if(i===secondaryActor&&secondaryPhase!=='idle'){pose=secondaryPhase==='impact'?'attack':secondaryPhase==='windup'?'windup':'recover';p=secondaryProgress;}
      else if(i===secondaryTarget&&secondaryPhase==='impact'){pose='hit';p=secondaryProgress;}
      const face=i<3?origins[i+3]:rigs[i-3].root.position;
      rig.root.rotation.y=Math.atan2(face.x-rig.root.position.x,face.z-rig.root.position.z);
      rig.pose({phase:pose,progress:p,time,ability:i===index?abilities[index]:undefined,seed:i,reduced:reduced.matches&&paused});
      const blend=renderedFrames===0?1:1-Math.exp(-dt*23);
      joints[i].forEach(j=>{j.node.position.lerpVectors(j.position,j.node.position,blend);j.node.quaternion.slerpQuaternions(j.rotation,j.node.quaternion,blend);j.position.copy(j.node.position);j.rotation.copy(j.node.quaternion);});
      selection[i].position.copy(rig.root.position);selection[i].position.y=.075;
    });
    scene.updateMatrixWorld(true);actor.muzzle.getWorldPosition(source);
    target.copy(targetOrigin);target.y=1.5;
    const targets=index===1?origins.slice(3).map(p=>p.clone().setY(1.4)):[target];
    effects.update({phase,progress,time,ability:abilities[index],kind:kinds[index],source,targets,allies:index===2?origins.slice(0,3):[],reduced:paused&&reduced.matches,eventKey:Math.floor(time/8)});
    rigs[opponentIndex].muzzle.getWorldPosition(returnSource);
    returnEffects.update({phase:counter?'impact':'idle',progress:(local-6)/1.15,time,kind:'sentry',source:returnSource,targets:[rigs[index].root.position.clone().setY(1.5)],allies:[],reduced:paused&&reduced.matches,eventKey:Math.floor(time/8)+5});
    rigs[secondaryActor].muzzle.getWorldPosition(distantSource);
    distantEffects.update({phase:secondaryPhase,progress:secondaryProgress,time,kind:'sentry',source:distantSource,targets:[rigs[secondaryTarget].root.position.clone().setY(1.5)],allies:[],reduced:paused&&reduced.matches,eventKey:Math.floor(time/2.6)});
    const blast=phase==='impact'?progress:phase==='recover'?.75+progress*.25:0;
    environment.update(time,blast,targetOrigin);
    impactLight.position.copy(target).add(new THREE.Vector3(0,1,0));impactLight.color.setHex(index===1?0xffa950:index===2?0xa8c7dd:0x9fe8ca);
    impactLight.intensity=phase==='impact'?35*(1-progress):0;
    const impactId=Math.floor(time/8);
    if(phase==='impact'&&lastImpact!==impactId&&!paused){lastImpact=impactId;callbacks.onImpact(index);}

    const small=width/height<1.15;
    const orbit=.43+Math.sin(time*.065)*.085+cinemaBlend*.16;
    const distance=small?39:35;
    const driftX=reduced.matches?0:pointer.x*.6,driftY=reduced.matches?0:pointer.y*.35;
    const shake=!paused&&!reduced.matches&&phase==='impact'?Math.sin(progress*32)*(1-progress)*.045:0;
    camera.position.set(Math.sin(orbit)*distance+driftX+shake,23-cinemaBlend*5+driftY,Math.cos(orbit)*distance);
    viewTarget.set(-1+cinemaBlend,1.2+cinemaBlend*.6,0);
    camera.lookAt(viewTarget);camera.updateMatrixWorld();
    composer.render();renderedFrames++;
    host.dataset.frame=String(renderedFrames);host.dataset.time=time.toFixed(2);host.dataset.motion=paused?'paused':'playing';
    callbacks.onTick(loop);
    // Lower resolution once on sustained slow devices, without changing the animation speed.
    if(!paused&&renderedFrames>40&&measuredFrames<120){measuredFrames++;if(dt>.035)slowFrames++;}
    if(measuredFrames===120&&slowFrames>70&&currentRatio>1){currentRatio=1;renderer.setPixelRatio(1);composer.setPixelRatio(1);resize();measuredFrames++;}
    frame=requestAnimationFrame(render);
  }
  frame=requestAnimationFrame(render);
  return {
    setPaused(value){paused=value;needsFrame=true;previous=performance.now();},
    setCinema(value){cinema=value;needsFrame=true;},
    dispose(){disposed=true;cancelAnimationFrame(frame);observer.disconnect();document.removeEventListener('pointermove',onMove);document.removeEventListener('pointerleave',onLeave);document.removeEventListener('visibilitychange',onVisibility);renderer.domElement.removeEventListener('webglcontextlost',onLost);rigs.forEach(r=>r.dispose());environment.dispose();effects.dispose();returnEffects.dispose();distantEffects.dispose();ringGeometry.dispose();ringMaterials.forEach(m=>m.dispose());sun.shadow.dispose();composer.dispose();bloom.dispose();renderer.dispose();renderer.domElement.remove();}
  };
}
