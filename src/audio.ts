// Synthesized locally; no audio downloads, autoplay, or microphone access.
export function createSound(){
  let context:AudioContext|undefined,master:GainNode|undefined,drone:OscillatorNode|undefined,enabled=false;
  async function setEnabled(value:boolean){
    if(value&&!context){
      context=new AudioContext();master=context.createGain();master.gain.value=0;master.connect(context.destination);
      drone=context.createOscillator();drone.type='sine';drone.frequency.value=48;
      const volume=context.createGain();volume.gain.value=.12;drone.connect(volume);volume.connect(master);drone.start();
    }
    if(value&&context)await context.resume();
    enabled=value;
    if(context&&master){master.gain.cancelScheduledValues(context.currentTime);master.gain.setTargetAtTime(value?.5:0,context.currentTime,.2);}
    return enabled;
  }
  function impact(kind:number){
    if(!enabled||!context||!master||context.state!=='running')return;
    const now=context.currentTime,osc=context.createOscillator(),gain=context.createGain();
    osc.type='sine';osc.frequency.setValueAtTime(kind===1?95:kind===2?65:180,now);osc.frequency.exponentialRampToValueAtTime(28,now+.65);
    gain.gain.setValueAtTime(.001,now);gain.gain.exponentialRampToValueAtTime(.5,now+.015);gain.gain.exponentialRampToValueAtTime(.001,now+1);
    osc.connect(gain);gain.connect(master);osc.start(now);osc.stop(now+1.1);
    const length=context.sampleRate*.45,buffer=context.createBuffer(1,length,context.sampleRate),data=buffer.getChannelData(0);
    for(let i=0;i<length;i++)data[i]=(Math.random()*2-1)*Math.pow(1-i/length,3);
    const noise=context.createBufferSource(),filter=context.createBiquadFilter(),noiseGain=context.createGain();
    noise.buffer=buffer;filter.type='lowpass';filter.frequency.value=kind===1?1300:650;noiseGain.gain.value=.15;
    noise.connect(filter);filter.connect(noiseGain);noiseGain.connect(master);noise.start(now);
    osc.onended=()=>{osc.disconnect();gain.disconnect();};noise.onended=()=>{noise.disconnect();filter.disconnect();noiseGain.disconnect();};
  }
  return {setEnabled,impact,suspend(){void context?.suspend();},resume(){if(enabled)void context?.resume();},dispose(){drone?.stop();void context?.close();}};
}
