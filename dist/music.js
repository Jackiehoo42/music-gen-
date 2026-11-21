'use strict';

const Music = (() => {
  const motifs = {
    classical: [[0,1,2,4,3,2,1,0], [0,2,4,2,1,3,2,0], [4,3,2,1,2,4,1,0], [0,4,3,1,2,3,1,0]],
    folk: [[0,2,4,5,4,2,1,0], [0,1,2,1,0,2,4,2], [2,4,5,4,2,1,0,0], [0,2,3,4,2,3,1,0]],
    cinematic: [[0,0,2,4,5,4,2,0], [0,4,5,6,5,2,1,0], [0,2,1,4,2,5,4,0], [4,5,2,0,1,2,1,0]],
  };
  const sharp = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  const natural = 'CDEFGAB';
  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  function choose(values) {
    return values[Math.floor(Math.random() * values.length)];
  }

  function settings(prompt, answers) {
    const words = prompt.toLowerCase();
    const namedMood = /\b(sad|dark|melanchol\w*|somber|spooky|mysterious)\b/.test(words) ? 'Wistful' :
      /\b(calm|gentle|soft|peaceful|dreamy|quiet|sleepy)\b/.test(words) ? 'Calm' : 'Bright';
    const mood = answers.mood || namedMood;
    const style = (answers.style || (/\b(folk|acoustic|rustic)\b/.test(words) ? 'Folk' :
      /\b(cinematic|epic|film|dramatic)\b/.test(words) ? 'Cinematic' : 'Classical')).toLowerCase();
    const arpeggio = answers.texture ? answers.texture === 'Arpeggiated' :
      /\barpeggi\w*/.test(words) && !/\b(no|without|not)\s+arpeggi\w*/.test(words);
    let tempo = {Bright:116, Calm:72, Wistful:84}[mood];
    if (/\b(fast|quick|upbeat)\b/.test(words)) tempo = 132;
    if (/\b(slow|unhurried)\b/.test(words)) tempo = 64;
    const explicit = words.match(/\b(\d{2,3})\s*bpm\b/);
    if (explicit) tempo = Math.max(50, Math.min(160, Number(explicit[1])));
    const key = prompt.match(/\b(?:in|key of)\s+([A-Ga-g])(#|♯|b|♭)?(?:\s+(major|minor))?\b/);
    const flats = {Db:1, Eb:3, Gb:6, Ab:8, Bb:10, Cb:11, Fb:4};
    const keyName = key && key[1].toUpperCase() + (key[2] || '').replace('♯','#').replace('♭','b');
    const tonic = key ? (flats[keyName] ?? Math.max(0, sharp.indexOf(keyName))) : mood === 'Wistful' ? 9 : 0;
    const minor = key?.[3] ? key[3] === 'minor' : mood === 'Wistful';
    return {tempo, style, arpeggio, tonic, minor};
  }

  // Learn transition frequencies from the original motifs for the selected style.
  function transitions(examples) {
    const learned = new Map();
    for (const motif of examples) {
      for (let index = 1; index < motif.length; index++) {
        const from = motif[index - 1];
        if (!learned.has(from)) learned.set(from, []);
        learned.get(from).push(motif[index]);
      }
    }
    return learned;
  }

  async function compose(prompt, answers, onStart, onNote, active) {
    if (!prompt.trim()) throw new Error('Describe your music idea first.');
    const profile = settings(prompt, answers);
    const scale = profile.minor ? [0,2,3,5,7,8,10] : [0,2,4,5,7,9,11];
    const learned = transitions(motifs[profile.style]);
    const offset = profile.tonic > 5 ? profile.tonic - 12 : profile.tonic;
    const versions = [];
    for (const version of [0,1]) {
      const tempo = profile.tempo + version * 8;
      const score = {tempo, notes:[]};
      versions.push(score);
      onStart(version, tempo);
      let degree = 0;
      for (let bar = 0; bar < 4; bar++) {
        const harmony = (version ? [0,3,4,0] : [0,5,4,0])[bar];
        const rhythm = bar === 3 ? [1,1,2] : profile.arpeggio ? [.5,.5,.5,.5,1,1] :
          choose(version ? [[.5,.5,1,1,1],[1,1,.5,.5,1]] : [[1,1,1,1],[1,1,2],[2,1,1]]);
        for (const [index, beats] of rhythm.entries()) {
          await delay(75);
          if (!active()) return null;
          if (bar === 3 && index === rhythm.length - 1) degree = 0;
          else if (profile.arpeggio) degree = (harmony + (version ? [4,2,0,2,4,2] : [0,2,4,2,0,4])[index]) % 7;
          else if (index === 0) degree = version === 1 && bar === 0 ? 2 : harmony;
          else degree = choose(learned.get(degree) || [0,2,4]);
          const note = {midi:60 + offset + scale[degree], beats, bar};
          score.notes.push(note);
          onNote(version, note);
        }
      }
    }
    return versions;
  }

  function notation(notes = [], decorative = false) {
    const width = 520, start = 57, gap = 10;
    let marks = '';
    for (let line = 0; line < 5; line++) {
      const y = 43 + line * gap;
      marks += '<path d="M15 '+y+'H507" opacity=".4"/>';
    }
    const elapsed = [0,0,0,0];
    for (const {midi, beats, bar} of notes) {
      const pitch = sharp[midi % 12];
      const step = (Math.floor(midi/12)-1)*7+natural.indexOf(pitch[0])-30;
      const y = 83 - step * 5;
      const x = start + 14 + bar * 110 + elapsed[bar] * 23;
      elapsed[bar] += beats;
      for (let ledger = 93; ledger <= y; ledger += 10) marks += '<path d="M'+(x-9)+' '+ledger+'h18"/>';
      if (pitch.length > 1) marks += '<text x="'+(x-17)+'" y="'+(y+5)+'" font-size="15" stroke="none" fill="currentColor">♯</text>';
      marks += '<ellipse cx="'+x+'" cy="'+y+'" rx="5.7" ry="4" transform="rotate(-23 '+x+' '+y+')" fill="'+(beats >= 2 ? 'none' : 'currentColor')+'"/>';
      marks += '<path d="M'+(x+5)+' '+y+'v-30"/>';
      if (beats === .5) marks += '<path d="M'+(x+5)+' '+(y-30)+'q1 5 8 10q5 4 0 10" fill="none"/>';
    }
    for (let bar = 1; bar <= 4; bar++) marks += '<path d="M'+(start+bar*110)+' 43v40" opacity=".55"/>';
    return '<svg viewBox="0 0 '+width+' 124" '+(decorative ? 'aria-hidden="true"' : 'role="img" aria-label="Sheet music, '+notes.length+' notes"')+' fill="none" stroke="currentColor" stroke-width="1.3"><text x="21" y="84" font-family="serif" font-size="49" stroke="none" fill="currentColor">𝄞</text><text x="48" y="59" text-anchor="middle" font-size="15" stroke="none" fill="currentColor">4<tspan x="48" dy="17">4</tspan></text>'+marks+'</svg>';
  }

  let audio;
  function play({tempo, notes}, ended) {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) throw new Error('Audio playback is unavailable in this browser.');
    audio ||= new Context();
    const readiness = audio.resume();
    const voices = [];
    let stopped = false;
    let timer;
    function stop() {
      stopped = true;
      clearTimeout(timer);
      for (const oscillator of voices) {
        try { oscillator.stop(); } catch {}
      }
    }
    readiness.then(() => {
      if (stopped) return;
      let time = audio.currentTime + .05;
      for (const note of notes) {
        const length = note.beats * 60 / tempo;
        const gain = audio.createGain();
        const oscillator = audio.createOscillator();
        oscillator.type = 'triangle';
        oscillator.frequency.value = 440 * 2 ** ((note.midi - 69) / 12);
        gain.gain.setValueAtTime(.001,time);
        gain.gain.exponentialRampToValueAtTime(.16,time+.015);
        gain.gain.exponentialRampToValueAtTime(.001,time+length*.93);
        oscillator.connect(gain).connect(audio.destination);
        oscillator.start(time);
        oscillator.stop(time+length);
        voices.push(oscillator);
        time += length;
      }
      timer = setTimeout(ended, Math.max(0, time - audio.currentTime) * 1000);
    }).catch(() => { if (!stopped) ended('Audio could not start. Try Play again.'); });
    return stop;
  }
  return {compose, notation, play};
})();
