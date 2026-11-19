/* Sintetizador sencillo con timbre de ocarina (Web Audio API). */
'use strict';

window.Synth = (function () {
  let ctx = null, master = null;
  const scheduled = new Set();

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.55;
      const comp = ctx.createDynamicsCompressor();
      master.connect(comp);
      comp.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function voice(midi, t0) {
    const f = 440 * Math.pow(2, (midi - 69) / 12);
    const o1 = ctx.createOscillator(); o1.type = 'sine'; o1.frequency.value = f;
    const o2 = ctx.createOscillator(); o2.type = 'triangle'; o2.frequency.value = f * 2;
    const g2 = ctx.createGain(); g2.gain.value = 0.05;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 5.3;
    const depth = ctx.createGain();
    depth.gain.setValueAtTime(0, t0);
    depth.gain.linearRampToValueAtTime(f * 0.005, t0 + 0.4);
    lfo.connect(depth); depth.connect(o1.frequency);

    // soplido: ruido filtrado muy suave al ataque
    const noise = ctx.createBufferSource();
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.25, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    noise.buffer = buf;
    const nf = ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = f * 2; nf.Q.value = 2;
    const ng = ctx.createGain(); ng.gain.value = 0.05;
    noise.connect(nf); nf.connect(ng);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t0);
    env.gain.linearRampToValueAtTime(0.42, t0 + 0.035);
    env.gain.linearRampToValueAtTime(0.32, t0 + 0.16);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3400;

    o1.connect(env); o2.connect(g2); g2.connect(env); ng.connect(env);
    env.connect(lp); lp.connect(master);
    const srcs = [o1, o2, lfo, noise];
    srcs.forEach(s => s.start(t0));

    let stopped = false;
    return {
      release(t) {
        if (stopped) return;
        stopped = true;
        t = Math.max(t, ctx.currentTime);
        env.gain.cancelScheduledValues(t);
        env.gain.setTargetAtTime(0, t, 0.035);
        srcs.forEach(s => { try { s.stop(t + 0.35); } catch (e) { /* ya parado */ } });
      },
      kill() {
        const now = ctx.currentTime;
        env.gain.cancelScheduledValues(now);
        env.gain.setValueAtTime(env.gain.value, now);
        env.gain.setTargetAtTime(0, now, 0.02);
        srcs.forEach(s => { try { s.stop(now + 0.15); } catch (e) { /* ya parado */ } });
        stopped = true;
      },
    };
  }

  /** Nota en vivo (piano): devuelve un objeto con stop(). */
  function start(midi) {
    if (!ensure()) return { stop() {} };
    const v = voice(midi, ctx.currentTime);
    return { stop: () => v.release(ctx.currentTime) };
  }

  /** Programa una nota para la reproducción. */
  function schedule(midi, t, dur) {
    const v = voice(midi, t);
    v.release(t + dur);
    scheduled.add(v);
    return v;
  }

  function stopAll() {
    scheduled.forEach(v => v.kill());
    scheduled.clear();
  }

  function now() { return ctx ? ctx.currentTime : 0; }

  return { ensure, start, schedule, stopAll, now };
})();
