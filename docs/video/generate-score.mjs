// Original instrumental score, generated locally. No external audio samples.
import {writeFileSync} from 'node:fs';
const rate=22050,seconds=40,samples=rate*seconds;
const pcm=Buffer.alloc(samples*2),chords=[[130.81,164.81,196],[110,130.81,164.81],[87.31,130.81,174.61],[98,123.47,146.83]];
const beat=60/90;
for(let i=0;i<samples;i++){
 const t=i/rate,fade=Math.min(1,t/2,(seconds-t)/2),chord=chords[Math.floor(t/4)%4];
 let value=0;
 for(const freq of chord)value+=.025*Math.sin(2*Math.PI*freq*t)+.01*Math.sin(2*Math.PI*freq*2*t);
 const phase=t%beat,step=Math.floor(t/beat),note=chord[step%3]*4;
 value+=.075*Math.exp(-phase*9)*Math.sin(2*Math.PI*note*phase);
 value+=.06*Math.exp(-phase*24)*Math.sin(2*Math.PI*(60+35*Math.exp(-phase*30))*phase);
 pcm.writeInt16LE(Math.round(value*fade*32767),i*2);
}
const header=Buffer.alloc(44);header.write('RIFF');header.writeUInt32LE(36+pcm.length,4);header.write('WAVE',8);header.write('fmt ',12);header.writeUInt32LE(16,16);header.writeUInt16LE(1,20);header.writeUInt16LE(1,22);header.writeUInt32LE(rate,24);header.writeUInt32LE(rate*2,28);header.writeUInt16LE(2,32);header.writeUInt16LE(16,34);header.write('data',36);header.writeUInt32LE(pcm.length,40);
writeFileSync(new URL('public/score.wav',import.meta.url),Buffer.concat([header,pcm]));
