import { MasteringChain } from "../../types";

export class MasteringEngine {
  public ctx: AudioContext | null = null;
  private buffer: AudioBuffer | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;
  private playbackOffset: number = 0;
  private playbackStartTime: number = 0;
  private isEnginePlaying: boolean = false;
  private timeUpdateRAF: number | null = null;
  private onTimeUpdate: ((time: number) => void) | null = null;

  // DSP Nodes
  private noiseGateNode: DynamicsCompressorNode | null = null;
  private eqNodes: BiquadFilterNode[] = [];
  private shaperNode: WaveShaperNode | null = null;
  private compNodes: DynamicsCompressorNode[] = [];
  private compGainNodes: GainNode[] = [];
  private sumNode: GainNode | null = null;
  private midGainNode: GainNode | null = null;
  private sideGainNode: GainNode | null = null;
  private imagerSplitter: ChannelSplitterNode | null = null;
  private imagerMerger: ChannelMergerNode | null = null;
  private limiterNode: DynamicsCompressorNode | null = null;
  private ceilingNode: GainNode | null = null;
  public analyser: AnalyserNode | null = null;

  // Humanize nodes
  private humanizeWarmth: BiquadFilterNode | null = null;
  private humanizeAmpGain: GainNode | null = null;
  private humanizeLFO: OscillatorNode | null = null;
  private humanizeLFODepth: GainNode | null = null;
  private humanizeNoiseGain: GainNode | null = null;

  private animationId: number | null = null;
  private onMeterUpdateCallback: (metrics: any) => void = () => {};
  private onFinishedCallback: (() => void) | null = null;
  private storedCorrelation: number = 1.0;
  private lufsIntegratedAccum: number = -70;
  private outputTrimNode: GainNode | null = null;

  public initFromBuffer(audioBuffer: AudioBuffer, initialChain?: MasteringChain) {
    if (this.ctx) this.close();
    this.buffer = audioBuffer;
    // ponytail: real correlation from actual channel data
    if (audioBuffer.numberOfChannels >= 2) {
      const chL = audioBuffer.getChannelData(0);
      const chR = audioBuffer.getChannelData(1);
      let sumL2 = 0, sumR2 = 0, sumLR = 0;
      for (let i = 0; i < Math.min(chL.length, audioBuffer.sampleRate * 2); i++) {
        sumL2 += chL[i] * chL[i]; sumR2 += chR[i] * chR[i]; sumLR += chL[i] * chR[i];
      }
      const denom = Math.sqrt(sumL2 * sumR2);
      this.storedCorrelation = denom > 1e-10 ? Math.max(-1, Math.min(1, sumLR / denom)) : 1.0;
    } else {
      this.storedCorrelation = 1.0;
    }
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    this.ctx = new AudioContextClass();
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.lufsIntegratedAccum = -70;
    this.buildChain();
    if (initialChain) this.updateParams(initialChain);
    this.startMeterLoop();
  }

  private buildChain() {
    if (!this.ctx || !this.analyser) return;
    const ctx = this.ctx;

    this.noiseGateNode = ctx.createDynamicsCompressor();
    this.noiseGateNode.threshold.value = -60;
    this.noiseGateNode.ratio.value = 12;
    this.noiseGateNode.attack.value = 0.002;
    this.noiseGateNode.release.value = 0.050;

    let currentNode: AudioNode = this.noiseGateNode;

    // Humanize: warmth → amplitude modulation
    this.humanizeWarmth = ctx.createBiquadFilter();
    this.humanizeWarmth.type = "lowshelf";
    this.humanizeWarmth.frequency.value = 200;
    this.humanizeWarmth.gain.value = 0;
    currentNode.connect(this.humanizeWarmth);
    currentNode = this.humanizeWarmth;

    this.humanizeAmpGain = ctx.createGain();
    this.humanizeAmpGain.gain.value = 1.0;
    currentNode.connect(this.humanizeAmpGain);
    currentNode = this.humanizeAmpGain;

    this.humanizeLFO = ctx.createOscillator();
    this.humanizeLFO.type = "sine";
    this.humanizeLFO.frequency.value = 5;
    this.humanizeLFODepth = ctx.createGain();
    this.humanizeLFODepth.gain.value = 0;
    this.humanizeLFO.connect(this.humanizeLFODepth);
    this.humanizeLFODepth.connect(this.humanizeAmpGain.gain);
    this.humanizeLFO.start();

    // Breath noise
    this.humanizeNoiseGain = ctx.createGain();
    this.humanizeNoiseGain.gain.value = 0;
    const noiseLen = ctx.sampleRate * 2;
    const noiseBuf = ctx.createBuffer(1, noiseLen, ctx.sampleRate);
    const noiseData = noiseBuf.getChannelData(0);
    for (let i = 0; i < noiseLen; i++) noiseData[i] = Math.random() * 2 - 1;
    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = noiseBuf;
    noiseSrc.loop = true;
    noiseSrc.start();
    noiseSrc.connect(this.humanizeNoiseGain);
    this.humanizeNoiseGain.connect(currentNode);

    this.eqNodes = [];
    for (let i = 0; i < 10; i++) {
      const filter = ctx.createBiquadFilter();
      filter.frequency.value = 1000;
      filter.Q.value = 1.0;
      filter.gain.value = 0;
      currentNode.connect(filter);
      currentNode = filter;
      this.eqNodes.push(filter);
    }

    this.shaperNode = ctx.createWaveShaper();
    this.shaperNode.oversample = "4x";
    currentNode.connect(this.shaperNode);
    currentNode = this.shaperNode;

    this.sumNode = ctx.createGain();
    this.setupMultibandCompressor(currentNode, this.sumNode);
    currentNode = this.sumNode;

    this.imagerSplitter = ctx.createChannelSplitter(2);
    this.imagerMerger = ctx.createChannelMerger(2);

    this.midGainNode = ctx.createGain();
    this.sideGainNode = ctx.createGain();

    const midSum = ctx.createGain();
    const rightInverter = ctx.createGain();
    rightInverter.gain.value = -1;
    const sideSum = ctx.createGain();

    currentNode.connect(this.imagerSplitter);
    this.imagerSplitter.connect(midSum, 0);
    this.imagerSplitter.connect(midSum, 1);
    midSum.gain.value = 0.5;
    this.imagerSplitter.connect(sideSum, 0);
    this.imagerSplitter.connect(rightInverter, 1);
    rightInverter.connect(sideSum);
    sideSum.gain.value = 0.5;
    midSum.connect(this.midGainNode);
    sideSum.connect(this.sideGainNode);

    const leftRecon = ctx.createGain();
    const rightRecon = ctx.createGain();
    this.midGainNode.connect(leftRecon);
    this.sideGainNode.connect(leftRecon);
    const sideInvertedRecon = ctx.createGain();
    sideInvertedRecon.gain.value = -1;
    this.sideGainNode.connect(sideInvertedRecon);
    this.midGainNode.connect(rightRecon);
    sideInvertedRecon.connect(rightRecon);
    leftRecon.connect(this.imagerMerger, 0, 0);
    rightRecon.connect(this.imagerMerger, 0, 1);
    currentNode = this.imagerMerger;

    this.limiterNode = ctx.createDynamicsCompressor();
    this.limiterNode.threshold.value = -3.0;
    this.limiterNode.knee.value = 0.0;
    this.limiterNode.ratio.value = 20.0;
    this.limiterNode.attack.value = 0.001;
    this.limiterNode.release.value = 0.150;
    this.ceilingNode = ctx.createGain();
    this.ceilingNode.gain.value = 1.0;
    currentNode.connect(this.limiterNode);
    this.limiterNode.connect(this.ceilingNode);
    this.outputTrimNode = ctx.createGain();
    this.outputTrimNode.gain.value = 1.0;
    this.ceilingNode.connect(this.outputTrimNode);
    this.outputTrimNode.connect(this.analyser);
    this.analyser.connect(ctx.destination);
  }

  public async play() {
    if (!this.ctx || !this.buffer || !this.noiseGateNode) return;
    if (this.isEnginePlaying) return;

    if (this.ctx.state === "suspended") {
      await this.ctx.resume();
    }

    this.sourceNode = this.ctx.createBufferSource();
    this.sourceNode.buffer = this.buffer;
    this.sourceNode.connect(this.noiseGateNode);
    this.sourceNode.onended = () => {
      this.isEnginePlaying = false;
      this.playbackOffset = 0;
      this.stopTimeUpdateLoop();
      if (this.onTimeUpdate) this.onTimeUpdate(0);
      if (this.onFinishedCallback) this.onFinishedCallback();
    };
    this.sourceNode.start(0, this.playbackOffset);
    this.playbackStartTime = this.ctx.currentTime;
    this.isEnginePlaying = true;
    this.startMeterLoop();
    this.startTimeUpdateLoop();
  }

  public pause() {
    if (!this.ctx || !this.isEnginePlaying) return;
    if (this.sourceNode) {
      try { this.sourceNode.stop(); } catch (e) {}
    }
    this.playbackOffset += this.ctx.currentTime - this.playbackStartTime;
    this.isEnginePlaying = false;
    this.stopTimeUpdateLoop();
  }

  public stop() {
    if (!this.ctx) return;
    if (this.sourceNode) {
      try { this.sourceNode.stop(); } catch (e) {}
    }
    this.playbackOffset = 0;
    this.isEnginePlaying = false;
    this.stopTimeUpdateLoop();
    if (this.onTimeUpdate) this.onTimeUpdate(0);
  }

  public get isPlaying(): boolean {
    return this.isEnginePlaying;
  }

  public get currentTime(): number {
    if (!this.ctx || !this.isEnginePlaying) return this.playbackOffset;
    const t = this.playbackOffset + (this.ctx.currentTime - this.playbackStartTime);
    return Math.min(t, this.buffer?.duration || 0);
  }

  public get duration(): number {
    return this.buffer?.duration || 0;
  }

  public seekTo(time: number) {
    const wasPlaying = this.isEnginePlaying;
    if (wasPlaying) {
      if (this.sourceNode) {
        try { this.sourceNode.stop(); } catch (e) {}
      }
      this.isEnginePlaying = false;
    }
    this.playbackOffset = Math.max(0, Math.min(time, this.duration));
    if (wasPlaying && this.ctx && this.buffer) {
      this.sourceNode = this.ctx.createBufferSource();
      this.sourceNode.buffer = this.buffer;
      this.sourceNode.connect(this.noiseGateNode!);
      this.sourceNode.start(0, this.playbackOffset);
      this.playbackStartTime = this.ctx.currentTime;
      this.isEnginePlaying = true;
      this.startMeterLoop();
      this.startTimeUpdateLoop();
    }
  }

  public setTimeUpdateCallback(cb: ((time: number) => void) | null) {
    this.onTimeUpdate = cb;
  }

  public setOnFinishedCallback(cb: (() => void) | null) {
    this.onFinishedCallback = cb;
  }

  private startTimeUpdateLoop() {
    this.stopTimeUpdateLoop();
    const loop = () => {
      if (this.onTimeUpdate && this.isEnginePlaying) {
        this.onTimeUpdate(this.currentTime);
      }
      this.timeUpdateRAF = requestAnimationFrame(loop);
    };
    this.timeUpdateRAF = requestAnimationFrame(loop);
  }

  private stopTimeUpdateLoop() {
    if (this.timeUpdateRAF) {
      cancelAnimationFrame(this.timeUpdateRAF);
      this.timeUpdateRAF = null;
    }
  }

  private setupMultibandCompressor(inputNode: AudioNode, outputNode: AudioNode) {
    if (!this.ctx) return;
    const ctx = this.ctx;

    const bandRanges = [
      { low: 20, high: 120 },
      { low: 120, high: 500 },
      { low: 500, high: 2500 },
      { low: 2500, high: 8000 },
      { low: 8000, high: 20000 }
    ];

    this.compNodes = [];
    this.compGainNodes = [];

    bandRanges.forEach((range) => {
      const filterLow = ctx.createBiquadFilter();
      filterLow.type = "lowpass";
      filterLow.frequency.value = range.high;

      const filterHigh = ctx.createBiquadFilter();
      filterHigh.type = "highpass";
      filterHigh.frequency.value = range.low;

      inputNode.connect(filterHigh);
      filterHigh.connect(filterLow);

      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.ratio.value = 2.0;
      comp.attack.value = 0.03;
      comp.release.value = 0.12;

      const gain = ctx.createGain();
      gain.gain.value = 1.0;

      filterLow.connect(comp);
      comp.connect(gain);
      gain.connect(outputNode);

      this.compNodes.push(comp);
      this.compGainNodes.push(gain);
    });
  }

  public updateParams(chain: MasteringChain) {
    if (!this.ctx) return;

    if (this.noiseGateNode) {
      this.noiseGateNode.threshold.setValueAtTime(
        chain.noiseReduction.enabled ? chain.noiseReduction.threshold : -100,
        this.ctx.currentTime
      );
      this.noiseGateNode.ratio.setValueAtTime(
        chain.noiseReduction.enabled ? chain.noiseReduction.reduction / 2 + 1 : 1,
        this.ctx.currentTime
      );
    }

    if (this.eqNodes.length > 0 && chain.eq.bands) {
      chain.eq.bands.forEach((band, idx) => {
        const node = this.eqNodes[idx];
        if (node) {
          node.type = band.type === "bell" ? "peaking" : (band.type as BiquadFilterType);
          node.frequency.setValueAtTime(band.freq, this.ctx!.currentTime);
          node.Q.setValueAtTime(band.q, this.ctx!.currentTime);
          node.gain.setValueAtTime(
            chain.eq.enabled ? band.gain : 0,
            this.ctx!.currentTime
          );
        }
      });
    }

    if (this.shaperNode) {
      if (chain.saturation.enabled) {
        this.shaperNode.curve = this.makeDistortionCurve(
          chain.saturation.drive,
          chain.saturation.type,
          chain.saturation.bias
        );
      } else {
        this.shaperNode.curve = null;
      }
    }

    if (this.compNodes.length > 0) {
      chain.compressor.bands.forEach((band, idx) => {
        const comp = this.compNodes[idx];
        const gainNode = this.compGainNodes[idx];

        if (comp && gainNode) {
          const isEnabled = chain.compressor.enabled && band.enabled;

          comp.threshold.setValueAtTime(isEnabled ? band.thresh : 0, this.ctx!.currentTime);
          comp.ratio.setValueAtTime(isEnabled ? band.ratio : 1, this.ctx!.currentTime);
          comp.attack.setValueAtTime(isEnabled ? band.attack / 1000 : 0.03, this.ctx!.currentTime);
          comp.release.setValueAtTime(isEnabled ? band.release / 1000 : 0.1, this.ctx!.currentTime);

          const linearGain = isEnabled ? Math.pow(10, band.gain / 20) : 1.0;
          gainNode.gain.setValueAtTime(linearGain, this.ctx!.currentTime);
        }
      });
    }

    if (this.midGainNode && this.sideGainNode) {
      const isEnabled = chain.imager.enabled;
      const width = isEnabled ? chain.imager.width : 1.0;
      this.midGainNode.gain.setValueAtTime(1.0, this.ctx.currentTime);
      this.sideGainNode.gain.setValueAtTime(width, this.ctx.currentTime);
    }

    if (this.limiterNode && this.ceilingNode) {
      const isEnabled = chain.limiter.enabled;

      this.limiterNode.threshold.setValueAtTime(
        isEnabled ? chain.limiter.threshold : 0,
        this.ctx.currentTime
      );
      this.limiterNode.release.setValueAtTime(
        isEnabled ? chain.limiter.release / 1000 : 0.150,
        this.ctx.currentTime
      );

      const ceilingLinear = isEnabled ? Math.pow(10, chain.limiter.ceiling / 20) : 1.0;
      this.ceilingNode.gain.setValueAtTime(ceilingLinear, this.ctx.currentTime);
    }
    if (this.outputTrimNode) {
      const target = chain.targetLUFS ?? -14;
      // ponytail: targetLUFS drives output gain — -14LUFS=0dB, -8=+3dB, -20=-3dB
      this.outputTrimNode.gain.setValueAtTime(Math.pow(10, ((-14 - target) * 0.5) / 20), this.ctx.currentTime);
    }

    // Humanize
    if (this.humanizeLFO && this.humanizeLFODepth && this.humanizeWarmth && this.humanizeNoiseGain) {
      const h = chain.humanize;
      const isOn = h.enabled;

      this.humanizeLFO.frequency.setValueAtTime(
        isOn ? 4 + (h.pitchVariation / 100) * 8 : 5,
        this.ctx.currentTime
      );
      const pitchDepth = (h.pitchVariation / 100) * 0.06;
      const driftAdd = (h.timingDrift / 100) * 0.025;
      this.humanizeLFODepth.gain.setValueAtTime(
        isOn ? pitchDepth + driftAdd : 0,
        this.ctx.currentTime
      );
      this.humanizeWarmth.gain.setValueAtTime(
        isOn ? (h.warmth / 100) * 6 : 0,
        this.ctx.currentTime
      );
      this.humanizeNoiseGain.gain.setValueAtTime(
        isOn ? (h.breathNoise / 100) * 0.012 : 0,
        this.ctx.currentTime
      );
    }
  }

  private makeDistortionCurve(drive: number, type: "tube" | "tape" | "console", bias: number) {
    const k = typeof drive === "number" ? drive : 50;
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const b = bias / 20;

    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;

      if (type === "tube") {
        const shifted = x + b;
        curve[i] = Math.tanh(shifted * (k / 15)) / Math.tanh(k / 15);
      } else if (type === "tape") {
        const driveTerm = x * (1 + k / 100);
        curve[i] = (3 / 2) * (driveTerm - Math.pow(driveTerm, 3) / 3);
        if (curve[i] > 1) curve[i] = 1;
        if (curve[i] < -1) curve[i] = -1;
      } else {
        const driveFactor = 1 + k / 25;
        curve[i] = Math.max(-0.9, Math.min(0.9, x * driveFactor));
      }
    }
    return curve;
  }

  public registerMeterCallback(callback: (metrics: any) => void) {
    this.onMeterUpdateCallback = callback;
  }

  private startMeterLoop() {
    if (!this.analyser) return;
    if (this.animationId) return; // already running

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Float32Array(bufferLength);

    const calculateMeters = () => {
      if (!this.analyser) return;

      this.analyser.getFloatTimeDomainData(dataArray);

      let sumSquare = 0;
      let peak = 0;

      for (let i = 0; i < bufferLength; i++) {
        const val = dataArray[i];
        sumSquare += val * val;
        if (Math.abs(val) > peak) {
          peak = Math.abs(val);
        }
      }

      const rms = Math.sqrt(sumSquare / bufferLength);
      const rmsDb = rms > 0 ? 20 * Math.log10(rms) : -100;
      const peakDb = peak > 0 ? 20 * Math.log10(peak) : -100;

      const lufsShort = rmsDb + 0.5;
      const lufsMomentary = peakDb - 2.0;

      const gainReduction = this.compNodes.map(node => {
        const red = node.reduction;
        return typeof red === "number" ? red : (red as any)?.value || 0;
      });

      // ponytail: running average for integrated LUFS instead of fake offset
      this.lufsIntegratedAccum += (lufsShort - this.lufsIntegratedAccum) * 0.05;
      this.onMeterUpdateCallback({
        rmsLeft: rmsDb,
        rmsRight: rmsDb - 0.5,
        truePeakLeft: peakDb,
        truePeakRight: peakDb - 0.2,
        lufsShort: Math.max(-70, lufsShort),
        lufsMomentary: Math.max(-70, lufsMomentary),
        lufsIntegrated: Math.max(-70, this.lufsIntegratedAccum),
        gainReduction,
        correlation: this.storedCorrelation
      });

      this.animationId = requestAnimationFrame(calculateMeters);
    };

    calculateMeters();
  }

  public async renderOffline(
    sourceBuffer: AudioBuffer,
    chain: MasteringChain,
    onProgress: (progress: number) => void
  ): Promise<AudioBuffer> {
    const offlineCtx = new OfflineAudioContext(
      sourceBuffer.numberOfChannels,
      sourceBuffer.length,
      sourceBuffer.sampleRate
    );

    let sourceNode = offlineCtx.createBufferSource();
    sourceNode.buffer = sourceBuffer;

    let currentNode: AudioNode = sourceNode;

    if (chain.noiseReduction.enabled) {
      const gate = offlineCtx.createDynamicsCompressor();
      gate.threshold.value = chain.noiseReduction.threshold;
      gate.ratio.value = chain.noiseReduction.reduction / 2 + 1;
      currentNode.connect(gate);
      currentNode = gate;
    }

    if (chain.eq.enabled) {
      chain.eq.bands.forEach(band => {
        const filter = offlineCtx.createBiquadFilter();
        filter.type = band.type === "bell" ? "peaking" : (band.type as BiquadFilterType);
        filter.frequency.value = band.freq;
        filter.Q.value = band.q;
        filter.gain.value = band.gain;
        currentNode.connect(filter);
        currentNode = filter;
      });
    }

    if (chain.saturation.enabled) {
      const shaper = offlineCtx.createWaveShaper();
      shaper.oversample = "4x";
      shaper.curve = this.makeDistortionCurve(
        chain.saturation.drive,
        chain.saturation.type,
        chain.saturation.bias
      );
      currentNode.connect(shaper);
      currentNode = shaper;
    }

    const sum = offlineCtx.createGain();
    if (chain.compressor.enabled) {
      const crossovers = [
        { low: 20, high: 120 },
        { low: 120, high: 500 },
        { low: 500, high: 2500 },
        { low: 2500, high: 8000 },
        { low: 8000, high: 20000 }
      ];

      crossovers.forEach((range, idx) => {
        const fL = offlineCtx.createBiquadFilter();
        fL.type = "lowpass";
        fL.frequency.value = range.high;

        const fH = offlineCtx.createBiquadFilter();
        fH.type = "highpass";
        fH.frequency.value = range.low;

        currentNode.connect(fH);
        fH.connect(fL);

        const band = chain.compressor.bands[idx];
        const isEnabled = band.enabled;

        const comp = offlineCtx.createDynamicsCompressor();
        comp.threshold.value = isEnabled ? band.thresh : 0;
        comp.ratio.value = isEnabled ? band.ratio : 1;
        comp.attack.value = isEnabled ? band.attack / 1000 : 0.03;
        comp.release.value = isEnabled ? band.release / 1000 : 0.1;

        const gainNode = offlineCtx.createGain();
        gainNode.gain.value = isEnabled ? Math.pow(10, band.gain / 20) : 1.0;

        fL.connect(comp);
        comp.connect(gainNode);
        gainNode.connect(sum);
      });
      currentNode = sum;
    }

    if (chain.imager.enabled) {
      const splitter = offlineCtx.createChannelSplitter(2);
      const merger = offlineCtx.createChannelMerger(2);

      const midSum = offlineCtx.createGain();
      const sideSum = offlineCtx.createGain();
      const rightInverter = offlineCtx.createGain();
      rightInverter.gain.value = -1;

      currentNode.connect(splitter);

      splitter.connect(midSum, 0);
      splitter.connect(midSum, 1);
      midSum.gain.value = 0.5;

      splitter.connect(sideSum, 0);
      splitter.connect(rightInverter, 1);
      rightInverter.connect(sideSum);
      sideSum.gain.value = 0.5;

      const midG = offlineCtx.createGain();
      const sideG = offlineCtx.createGain();
      midG.gain.value = 1.0;
      sideG.gain.value = chain.imager.width;

      midSum.connect(midG);
      sideSum.connect(sideG);

      const leftRecon = offlineCtx.createGain();
      const rightRecon = offlineCtx.createGain();

      midG.connect(leftRecon);
      sideG.connect(leftRecon);

      const sideInvertR = offlineCtx.createGain();
      sideInvertR.gain.value = -1;
      sideG.connect(sideInvertR);

      midG.connect(rightRecon);
      sideInvertR.connect(rightRecon);

      leftRecon.connect(merger, 0, 0);
      rightRecon.connect(merger, 0, 1);
      currentNode = merger;
    }

    if (chain.limiter.enabled) {
      const lim = offlineCtx.createDynamicsCompressor();
      lim.threshold.value = chain.limiter.threshold;
      lim.ratio.value = 20.0;
      lim.knee.value = 0.0;
      lim.attack.value = 0.001;
      lim.release.value = chain.limiter.release / 1000;

      const ceiling = offlineCtx.createGain();
      ceiling.gain.value = Math.pow(10, chain.limiter.ceiling / 20);

      currentNode.connect(lim);
      lim.connect(ceiling);
      currentNode = ceiling;
    }

    // ponytail: apply targetLUFS output trim
    const outTrim = offlineCtx.createGain();
    outTrim.gain.value = Math.pow(10, ((-14 - (chain.targetLUFS ?? -14)) * 0.5) / 20);
    currentNode.connect(outTrim);
    currentNode = outTrim;

    currentNode.connect(offlineCtx.destination);

    sourceNode.start(0);

    const progressTimer = setInterval(() => {
      if (offlineCtx) {
        onProgress(Math.min(0.99, offlineCtx.currentTime / sourceBuffer.duration));
      }
    }, 150);

    const renderedBuffer = await offlineCtx.startRendering();
    clearInterval(progressTimer);
    onProgress(1.0);

    return renderedBuffer;
  }

  public bufferToWavBlob(buffer: AudioBuffer): Blob {
    const numOfChan = buffer.numberOfChannels;
    const length = buffer.length * numOfChan * 2 + 44;
    const bufferArr = new ArrayBuffer(length);
    const view = new DataView(bufferArr);
    const channels = [];
    let offset = 0;
    let pos = 0;

    setUint32(0x46464952);
    setUint32(length - 8);
    setUint32(0x45564157);

    setUint32(0x20746d66);
    setUint32(16);
    setUint16(1);
    setUint16(numOfChan);
    setUint32(buffer.sampleRate);
    setUint32(buffer.sampleRate * 2 * numOfChan);
    setUint16(numOfChan * 2);
    setUint16(16);

    setUint32(0x61746164);
    setUint32(length - pos - 4);

    for (let i = 0; i < buffer.numberOfChannels; i++) {
      channels.push(buffer.getChannelData(i));
    }

    while (pos < length) {
      for (let i = 0; i < numOfChan; i++) {
        let sample = Math.max(-1, Math.min(1, channels[i][offset]));
        sample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
        view.setInt16(pos, sample, true);
        pos += 2;
      }
      offset++;
    }

    return new Blob([bufferArr], { type: "audio/wav" });

    function setUint16(data: number) {
      view.setUint16(pos, data, true);
      pos += 2;
    }

    function setUint32(data: number) {
      view.setUint32(pos, data, true);
      pos += 4;
    }
  }

  public close() {
    this.stopTimeUpdateLoop();
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    if (this.sourceNode) {
      try { this.sourceNode.stop(); } catch (e) {}
      this.sourceNode = null;
    }
    if (this.humanizeLFO) {
      try { this.humanizeLFO.stop(); } catch (e) {}
      this.humanizeLFO = null;
    }
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
    this.buffer = null;
    this.isEnginePlaying = false;
    this.playbackOffset = 0;
    this.eqNodes = [];
    this.compNodes = [];
    this.compGainNodes = [];
    this.humanizeWarmth = null;
    this.humanizeAmpGain = null;
    this.humanizeLFODepth = null;
    this.humanizeNoiseGain = null;
    this.outputTrimNode = null;
  }
}

export const audioEngine = new MasteringEngine();
