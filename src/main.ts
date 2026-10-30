import './style.css';
import { createSound } from './audio';
import type { BattleController } from './battle';

const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const motion=matchMedia('(prefers-reduced-motion:reduce)');
let paused=motion.matches,cinema=false,soundEnabled=false,battle:BattleController|undefined;
const sound=createSound();
const pauseButton=$<HTMLButtonElement>('pause'),soundButton=$<HTMLButtonElement>('sound'),watch=$<HTMLButtonElement>('watch'),exit=$<HTMLButtonElement>('exit-cinema');
const progress=$('sequence-progress'),counter=$('sequence-number');

function updatePause(){
  pauseButton.setAttribute('aria-pressed',String(paused));pauseButton.setAttribute('aria-label',paused?'Play animation':'Pause animation');
  pauseButton.innerHTML=paused?'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 4 13 8-13 8V4Z"/></svg><span>PLAY</span>':'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14"/></svg><span>PAUSE</span>';
  document.body.classList.toggle('motion-paused',paused);battle?.setPaused(paused);
  if(paused)sound.suspend();else if(!document.hidden)sound.resume();
}
pauseButton.addEventListener('click',()=>{paused=!paused;updatePause();});
motion.addEventListener('change',()=>{paused=motion.matches;updatePause();});
updatePause();

function setCinema(value:boolean){
  cinema=value;document.body.classList.toggle('cinema',value);exit.hidden=!value;
  document.querySelector<HTMLElement>('.hero-copy')!.inert=value;
  battle?.setCinema(value);
  if(value){exit.focus({preventScroll:true});}else watch.focus({preventScroll:true});
}
watch.addEventListener('click',()=>setCinema(true));exit.addEventListener('click',()=>setCinema(false));
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&cinema)setCinema(false);});
soundButton.addEventListener('click',async()=>{
  try{
    soundEnabled=await sound.setEnabled(!soundEnabled);
    soundButton.setAttribute('aria-pressed',String(soundEnabled));soundButton.setAttribute('aria-label',soundEnabled?'Mute battle sound':'Enable battle sound');
    soundButton.innerHTML=soundEnabled?'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m11 5-5 4H3v6h3l5 4V5ZM16 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/></svg><span>SOUND ON</span>':'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m11 5-5 4H3v6h3l5 4V5ZM16 9l5 6m0-6-5 6"/></svg><span>SOUND OFF</span>';
    if(paused)sound.suspend();
  }catch{soundButton.disabled=true;soundButton.setAttribute('aria-label','Sound unavailable');}
});
document.addEventListener('visibilitychange',()=>{if(document.hidden)sound.suspend();else if(!paused)sound.resume();});

function unavailable(){
  document.body.classList.remove('scene-ready');document.body.classList.add('scene-unavailable');
  $('scene-loading').hidden=false;$('scene-loading').textContent='THE SIGNAL WILL RETURN.';
  pauseButton.disabled=true;soundButton.disabled=true;watch.disabled=true;
  sound.suspend();
}

async function start(){
  try{
    const {createBattle}=await import('./battle');
    battle=createBattle($('battlefield'),paused,{
      onTick(time){progress.style.width=`${time/24*100}%`;counter.textContent=`00:${Math.floor(time).toString().padStart(2,'0')}`;},
      onImpact:sound.impact,onUnavailable:unavailable
    });
    battle.setCinema(cinema);document.body.classList.add('scene-ready');$('scene-loading').hidden=true;
  }catch(error){console.error('Battle preview unavailable',error);unavailable();}
}
void start();
window.addEventListener('pagehide',()=>{sound.suspend();});
window.addEventListener('pageshow',()=>{if(!paused&&!document.hidden)sound.resume();});
if(import.meta.hot)import.meta.hot.dispose(()=>{battle?.dispose();sound.dispose();});
