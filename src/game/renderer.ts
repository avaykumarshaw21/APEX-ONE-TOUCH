/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BakedTrack } from './physics';
import {
  CarEntity,
  Particle,
  TrackDefinition,
  FloatingNotification,
  TrackWeather,
  CameraZoomMode,
  ReplayCameraState,
} from './types';

export class GameRenderer {
  private ctx: CanvasRenderingContext2D;
  public cameraX: number = 0;
  public cameraY: number = 0;
  public screenShake: number = 0;
  private currentZoom: number = 1.0;
  private trackCacheKey: string | null = null;
  private trackCacheCanvas: HTMLCanvasElement | null = null;
  private trackCacheMinX: number = 0;
  private trackCacheMinY: number = 0;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }

  public getCameraState(): ReplayCameraState {
    return {
      cameraX: this.cameraX,
      cameraY: this.cameraY,
      zoom: this.currentZoom,
      screenShake: this.screenShake,
    };
  }

  public render(
    track: TrackDefinition,
    baked: BakedTrack,
    cars: CarEntity[],
    playerCar: CarEntity,
    particles: Particle[],
    notifications: FloatingNotification[],
    viewportWidth: number,
    viewportHeight: number,
    time: number,
    weather: TrackWeather = 'clear',
    cameraZoom: CameraZoomMode = 'normal',
    cameraOverride?: ReplayCameraState
  ) {
    const ctx = this.ctx;

    if (cameraOverride) {
      this.cameraX = cameraOverride.cameraX;
      this.cameraY = cameraOverride.cameraY;
      this.currentZoom = cameraOverride.zoom > 0 ? cameraOverride.zoom : 1.0;
      this.screenShake = cameraOverride.screenShake;
    } else {
      // Smooth camera zoom interpolation
      const targetZoom = cameraZoom === 'wide' ? 0.8 : 1.0;
      this.currentZoom += (targetZoom - this.currentZoom) * 0.1;

      // Smooth camera tracking with lookahead along velocity
      const lookaheadDist = Math.min(180, playerCar.speed * 0.35);
      const targetCamX = playerCar.x + Math.cos(playerCar.angle) * lookaheadDist;
      const targetCamY = playerCar.y + Math.sin(playerCar.angle) * lookaheadDist;

      this.cameraX += (targetCamX - this.cameraX) * 0.12;
      this.cameraY += (targetCamY - this.cameraY) * 0.12;
    }

    // Screen shake decay
    let shakeX = 0;
    let shakeY = 0;
    if (this.screenShake > 0.01) {
      shakeX = (Math.random() - 0.5) * this.screenShake * 16;
      shakeY = (Math.random() - 0.5) * this.screenShake * 16;
      if (!cameraOverride) {
        this.screenShake *= 0.88;
      }
    }

    ctx.save();
    // Clear viewport
    ctx.fillStyle = track.theme.groundColor;
    ctx.fillRect(0, 0, viewportWidth, viewportHeight);

    // Apply camera transformation centered on screen
    ctx.translate(viewportWidth / 2 + shakeX, viewportHeight / 2 + shakeY);
    ctx.scale(this.currentZoom, this.currentZoom);
    ctx.translate(-this.cameraX, -this.cameraY);

    const vpWorldW = viewportWidth / this.currentZoom;
    const vpWorldH = viewportHeight / this.currentZoom;

    // 1. Draw Ground Texture / Grid
    this.drawGroundDetails(track, vpWorldW, vpWorldH);

    // 2. Draw Track Asphalt & Guardrails
    this.drawTrack(track, baked, vpWorldW, vpWorldH);

    // 3. Draw Boost Pads, Hazards & Coins
    this.drawTrackItems(track, time, vpWorldW, vpWorldH);

    // 4. Draw Persistent Skid Marks
    this.drawSkidMarks(cars);

    // 5. Draw Particles (Smoke, Sparks, Mini-Turbo sparks, Flames)
    this.drawParticles(particles);

    // 6. Draw Cars (Sorted by Y for visual depth)
    const sortedCars = [...cars].sort((a, b) => a.y - b.y);
    for (const car of sortedCars) {
      this.drawCar(car, time, weather);
    }

    // 7. Draw Floating Notifications in World Space
    this.drawFloatingNotifications(notifications);

    ctx.restore();

    // 8. Weather Overlay (Night Rush vignette or Wet Slicks rain streaks)
    this.drawWeatherOverlay(weather, viewportWidth, viewportHeight, time);

    // 9. Screen-space High Speed Wind/Tunnel Streaks
    this.drawSpeedLines(playerCar, viewportWidth, viewportHeight, time);
  }

  private drawGroundDetails(track: TrackDefinition, vpWidth: number, vpHeight: number) {
    const ctx = this.ctx;
    const gridSize = 160;
    const startX = Math.floor((this.cameraX - vpWidth / 2 - 100) / gridSize) * gridSize;
    const endX = Math.ceil((this.cameraX + vpWidth / 2 + 100) / gridSize) * gridSize;
    const startY = Math.floor((this.cameraY - vpHeight / 2 - 100) / gridSize) * gridSize;
    const endY = Math.ceil((this.cameraY + vpHeight / 2 + 100) / gridSize) * gridSize;

    ctx.strokeStyle = track.theme.groundAccent;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.35;

    ctx.beginPath();
    for (let x = startX; x <= endX; x += gridSize) {
      ctx.moveTo(x, startY);
      ctx.lineTo(x, endY);
    }
    for (let y = startY; y <= endY; y += gridSize) {
      ctx.moveTo(startX, y);
      ctx.lineTo(endX, y);
    }
    ctx.stroke();
    ctx.globalAlpha = 1.0;
  }

  private getOrBuildTrackCache(track: TrackDefinition, baked: BakedTrack) {
    if (typeof document === 'undefined' || baked.samples.length === 0) return null;
    const key = `${track.id}:${baked.samples.length}:${track.roadWidth}`;
    if (this.trackCacheKey === key && this.trackCacheCanvas) {
      return {
        canvas: this.trackCacheCanvas,
        minX: this.trackCacheMinX,
        minY: this.trackCacheMinY,
      };
    }

    const samples = baked.samples;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < samples.length; i++) {
      const s = samples[i];
      if (s.x < minX) minX = s.x;
      if (s.y < minY) minY = s.y;
      if (s.x > maxX) maxX = s.x;
      if (s.y > maxY) maxY = s.y;
    }

    const pad = Math.ceil(track.roadWidth / 2 + 48);
    const originX = Math.floor(minX - pad);
    const originY = Math.floor(minY - pad);
    const width = Math.ceil(maxX - minX + pad * 2);
    const height = Math.ceil(maxY - minY + pad * 2);

    const offscreen = document.createElement('canvas');
    offscreen.width = width;
    offscreen.height = height;
    const octx = offscreen.getContext('2d');
    if (!octx) return null;

    octx.save();
    octx.translate(-originX, -originY);

    const halfWidth = track.roadWidth / 2;

    // 1. Kerb Borders
    octx.lineWidth = track.roadWidth + 24;
    octx.strokeStyle = track.theme.asphaltEdgeColor;
    octx.lineCap = 'round';
    octx.lineJoin = 'round';
    octx.beginPath();
    for (let i = 0; i < samples.length; i++) {
      const s = samples[i];
      if (i === 0) octx.moveTo(s.x, s.y);
      else octx.lineTo(s.x, s.y);
    }
    octx.closePath();
    octx.stroke();

    // 2. Asphalt Surface
    octx.lineWidth = track.roadWidth;
    octx.strokeStyle = track.theme.asphaltColor;
    octx.beginPath();
    for (let i = 0; i < samples.length; i++) {
      const s = samples[i];
      if (i === 0) octx.moveTo(s.x, s.y);
      else octx.lineTo(s.x, s.y);
    }
    octx.closePath();
    octx.stroke();

    // 3. Alternating Kerb Stripes
    const kerbSegmentLen = 6;
    for (let i = 0; i < samples.length; i += kerbSegmentLen) {
      const s1 = samples[i];
      const color = Math.floor(i / kerbSegmentLen) % 2 === 0 ? track.theme.kerbColor1 : track.theme.kerbColor2;
      octx.fillStyle = color;

      octx.beginPath();
      octx.arc(s1.x + s1.nx * halfWidth, s1.y + s1.ny * halfWidth, 6, 0, Math.PI * 2);
      octx.fill();

      octx.beginPath();
      octx.arc(s1.x - s1.nx * halfWidth, s1.y - s1.ny * halfWidth, 6, 0, Math.PI * 2);
      octx.fill();
    }

    // 4. Center Dash Lines
    octx.lineWidth = 4;
    octx.strokeStyle = track.id === 'neon_metropolis' ? '#00f0ff' : '#facc15';
    octx.globalAlpha = 0.55;
    octx.setLineDash([20, 24]);
    octx.beginPath();
    for (let i = 0; i < samples.length; i++) {
      const s = samples[i];
      if (i === 0) octx.moveTo(s.x, s.y);
      else octx.lineTo(s.x, s.y);
    }
    octx.closePath();
    octx.stroke();
    octx.setLineDash([]);
    octx.globalAlpha = 1.0;

    // 5. Start / Finish Line Banner
    const startSample = samples[0];
    octx.save();
    octx.translate(startSample.x, startSample.y);
    octx.rotate(startSample.angle + Math.PI / 2);
    const bannerWidth = track.roadWidth - 10;
    const checkSize = 14;
    const halfChecks = Math.floor(bannerWidth / (checkSize * 2));
    for (let c = -halfChecks; c < halfChecks; c++) {
      for (let r = -1; r <= 1; r++) {
        octx.fillStyle = Math.abs(c + r) % 2 === 0 ? '#ffffff' : '#000000';
        octx.fillRect(c * checkSize, r * checkSize, checkSize, checkSize);
      }
    }
    octx.restore();
    octx.restore();

    this.trackCacheKey = key;
    this.trackCacheCanvas = offscreen;
    this.trackCacheMinX = originX;
    this.trackCacheMinY = originY;

    return {
      canvas: offscreen,
      minX: originX,
      minY: originY,
    };
  }

  private drawTrack(track: TrackDefinition, baked: BakedTrack, vpW: number, vpH: number) {
    const ctx = this.ctx;
    const cached = this.getOrBuildTrackCache(track, baked);
    if (cached) {
      const margin = 40;
      const viewLeft = this.cameraX - vpW * 0.5 - margin;
      const viewTop = this.cameraY - vpH * 0.5 - margin;
      const viewRight = this.cameraX + vpW * 0.5 + margin;
      const viewBottom = this.cameraY + vpH * 0.5 + margin;

      const sx = Math.max(0, Math.floor(viewLeft - cached.minX));
      const sy = Math.max(0, Math.floor(viewTop - cached.minY));
      const ex = Math.min(cached.canvas.width, Math.ceil(viewRight - cached.minX));
      const ey = Math.min(cached.canvas.height, Math.ceil(viewBottom - cached.minY));
      const sw = ex - sx;
      const sh = ey - sy;

      if (sw > 0 && sh > 0) {
        ctx.drawImage(
          cached.canvas,
          sx,
          sy,
          sw,
          sh,
          cached.minX + sx,
          cached.minY + sy,
          sw,
          sh
        );
      }
      return;
    }

    const samples = baked.samples;
    const halfWidth = track.roadWidth / 2;
    const cullHalfW = vpW * 0.5 + 120;
    const cullHalfH = vpH * 0.5 + 120;

    // Draw Kerb Borders (Outer and Inner colored strips)
    ctx.lineWidth = track.roadWidth + 24;
    ctx.strokeStyle = track.theme.asphaltEdgeColor;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i < samples.length; i++) {
      const s = samples[i];
      if (i === 0) ctx.moveTo(s.x, s.y);
      else ctx.lineTo(s.x, s.y);
    }
    ctx.closePath();
    ctx.stroke();

    // Draw Asphalt Surface
    ctx.lineWidth = track.roadWidth;
    ctx.strokeStyle = track.theme.asphaltColor;
    ctx.beginPath();
    for (let i = 0; i < samples.length; i++) {
      const s = samples[i];
      if (i === 0) ctx.moveTo(s.x, s.y);
      else ctx.lineTo(s.x, s.y);
    }
    ctx.closePath();
    ctx.stroke();

    // Draw Alternating Kerb Stripes along outer edges (culled to visible viewport)
    const kerbSegmentLen = 6;
    for (let i = 0; i < samples.length; i += kerbSegmentLen) {
      const s1 = samples[i];
      if (
        Math.abs(s1.x - this.cameraX) > cullHalfW ||
        Math.abs(s1.y - this.cameraY) > cullHalfH
      ) {
        continue;
      }
      const color = Math.floor(i / kerbSegmentLen) % 2 === 0 ? track.theme.kerbColor1 : track.theme.kerbColor2;

      ctx.fillStyle = color;
      // Right kerb
      ctx.beginPath();
      ctx.arc(s1.x + s1.nx * halfWidth, s1.y + s1.ny * halfWidth, 6, 0, Math.PI * 2);
      ctx.fill();

      // Left kerb
      ctx.beginPath();
      ctx.arc(s1.x - s1.nx * halfWidth, s1.y - s1.ny * halfWidth, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw Center Dash Lines
    ctx.lineWidth = 4;
    ctx.strokeStyle = track.id === 'neon_metropolis' ? '#00f0ff' : '#facc15';
    ctx.globalAlpha = 0.55;
    ctx.setLineDash([20, 24]);
    ctx.beginPath();
    for (let i = 0; i < samples.length; i++) {
      const s = samples[i];
      if (i === 0) ctx.moveTo(s.x, s.y);
      else ctx.lineTo(s.x, s.y);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1.0;

    // Draw Start / Finish Line Banner
    const startSample = samples[0];
    ctx.save();
    ctx.translate(startSample.x, startSample.y);
    ctx.rotate(startSample.angle + Math.PI / 2);

    // Checkered Banner
    const bannerWidth = track.roadWidth - 10;
    const checkSize = 14;
    const halfChecks = Math.floor(bannerWidth / (checkSize * 2));
    for (let c = -halfChecks; c < halfChecks; c++) {
      for (let r = -1; r <= 1; r++) {
        ctx.fillStyle = Math.abs(c + r) % 2 === 0 ? '#ffffff' : '#000000';
        ctx.fillRect(c * checkSize, r * checkSize, checkSize, checkSize);
      }
    }
    ctx.restore();
  }

  private drawTrackItems(track: TrackDefinition, time: number, vpW: number, vpH: number) {
    const ctx = this.ctx;
    const cullHalfW = vpW * 0.5 + 100;
    const cullHalfH = vpH * 0.5 + 100;

    // 1. Boost Pads
    for (const pad of track.boostPads) {
      if (
        Math.abs(pad.x - this.cameraX) > cullHalfW ||
        Math.abs(pad.y - this.cameraY) > cullHalfH
      ) {
        continue;
      }
      ctx.save();
      ctx.translate(pad.x, pad.y);
      ctx.rotate(pad.angle);

      const pulse = 0.7 + Math.sin(time * 8) * 0.3;
      ctx.fillStyle = `rgba(6, 182, 212, ${0.35 * pulse})`;
      ctx.fillRect(-pad.length / 2, -pad.width / 2, pad.length, pad.width);

      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 5;

      for (let offset = -18; offset <= 18; offset += 18) {
        ctx.beginPath();
        ctx.moveTo(offset - 10, -18);
        ctx.lineTo(offset + 8, 0);
        ctx.lineTo(offset - 10, 18);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 2. Hazards (Oil slick, Cones)
    for (const h of track.hazards) {
      if (
        Math.abs(h.x - this.cameraX) > cullHalfW ||
        Math.abs(h.y - this.cameraY) > cullHalfH
      ) {
        continue;
      }
      ctx.save();
      ctx.translate(h.x, h.y);
      if (h.type === 'oil') {
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.ellipse(0, 0, h.radius * 1.2, h.radius * 0.8, 0.4, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#a855f7';
        ctx.lineWidth = 3;
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.ellipse(2, -1, h.radius * 0.7, h.radius * 0.4, 0.4, 0, Math.PI * 2);
        ctx.stroke();
      } else if (h.type === 'cone') {
        ctx.fillStyle = '#f97316';
        ctx.beginPath();
        ctx.arc(0, 0, h.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, h.radius * 0.5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(-h.radius, -10, h.radius * 2, 20);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-h.radius * 0.4, -10, h.radius * 0.8, 20);
      }
      ctx.restore();
    }

    // 3. Coins
    for (const coin of track.coins) {
      if (coin.collected) continue;
      if (
        Math.abs(coin.x - this.cameraX) > cullHalfW ||
        Math.abs(coin.y - this.cameraY) > cullHalfH
      ) {
        continue;
      }
      ctx.save();
      ctx.translate(coin.x, coin.y);

      const scaleX = Math.cos(time * 4);
      ctx.scale(Math.abs(scaleX) * 0.7 + 0.3, 1.0);

      // Soft additive halo (fast, no shadowBlur)
      ctx.fillStyle = 'rgba(250, 204, 21, 0.25)';
      ctx.beginPath();
      ctx.arc(0, 0, 19, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#eab308';
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ca8a04';
      ctx.fillRect(-2, -5, 4, 10);
      ctx.restore();
    }
  }

  private drawSkidMarks(cars: CarEntity[]) {
    const ctx = this.ctx;
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#090a0f';

    for (const car of cars) {
      if (car.skidPoints.length < 2) continue;
      for (let i = 0; i < car.skidPoints.length - 1; i++) {
        const p1 = car.skidPoints[i];
        const p2 = car.skidPoints[i + 1];
        ctx.globalAlpha = p1.alpha * 0.35;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1.0;
  }

  private drawParticles(particles: Particle[]) {
    const ctx = this.ctx;
    for (const p of particles) {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private drawCar(car: CarEntity, time: number, weather: TrackWeather = 'clear') {
    const ctx = this.ctx;
    ctx.save();
    if (car.isEliminated) {
      ctx.globalAlpha = 0.35;
    }
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);

    // Car Body dimensions
    const length = 46;
    const width = 24;

    // Night Rush Headlight Cone
    if (weather === 'night' && !car.isEliminated) {
      const grad = ctx.createLinearGradient(length / 2, 0, length / 2 + 150, 0);
      grad.addColorStop(0, 'rgba(254, 240, 138, 0.42)');
      grad.addColorStop(1, 'rgba(254, 240, 138, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(length / 2, -width / 2 + 2);
      ctx.lineTo(length / 2 + 150, -48);
      ctx.lineTo(length / 2 + 150, 48);
      ctx.lineTo(length / 2, width / 2 - 2);
      ctx.closePath();
      ctx.fill();
    }

    // 1. Drop Shadow under car
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.roundRect(-length / 2 + 3, -width / 2 + 3, length, width, 5);
    ctx.fill();

    // 2. Wheels (4 tires) with front wheel steer angle
    const wheelLen = 11;
    const wheelWid = 5;
    ctx.fillStyle = '#18181b';

    // Rear Left & Right wheels (fixed angle)
    ctx.fillRect(-length / 2 + 6, -width / 2 - 2, wheelLen, wheelWid);
    ctx.fillRect(-length / 2 + 6, width / 2 - 3, wheelLen, wheelWid);

    // Front Wheels (steered by car.steerAngle)
    const steer = car.steerAngle * 0.8;
    // Front Left
    ctx.save();
    ctx.translate(length / 2 - 12, -width / 2);
    ctx.rotate(steer);
    ctx.fillRect(-wheelLen / 2, -wheelWid / 2, wheelLen, wheelWid);
    ctx.restore();

    // Front Right
    ctx.save();
    ctx.translate(length / 2 - 12, width / 2);
    ctx.rotate(steer);
    ctx.fillRect(-wheelLen / 2, -wheelWid / 2, wheelLen, wheelWid);
    ctx.restore();

    // 3. Car Chassis / Body
    ctx.fillStyle = car.carStats.primaryColor;
    ctx.beginPath();
    ctx.roundRect(-length / 2, -width / 2, length, width, 6);
    ctx.fill();

    // 4. Secondary Racing Stripes / Accents
    ctx.fillStyle = car.carStats.secondaryColor;
    ctx.fillRect(-length / 2 + 4, -4, length - 8, 8);

    // 5. Cockpit & Windshield
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.roundRect(-8, -width / 2 + 4, 18, width - 8, 4);
    ctx.fill();

    // Glass glare reflection
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.beginPath();
    ctx.moveTo(0, -width / 2 + 6);
    ctx.lineTo(6, -width / 2 + 6);
    ctx.lineTo(2, width / 2 - 6);
    ctx.lineTo(-4, width / 2 - 6);
    ctx.closePath();
    ctx.fill();

    // 6. Rear Spoiler
    ctx.fillStyle = car.carStats.accentColor || '#ffffff';
    ctx.fillRect(-length / 2 - 2, -width / 2 + 2, 4, width - 4);

    // 7. Headlights (Front bright beams)
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(length / 2 - 3, -width / 2 + 2, 4, 4);
    ctx.fillRect(length / 2 - 3, width / 2 - 6, 4, 4);

    // 8. Taillights (Red glow, flares bright on drift)
    const isBrakingOrDrifting = car.isDrifting || car.speed < 100;
    ctx.fillStyle = isBrakingOrDrifting ? '#ef4444' : '#991b1b';
    ctx.fillRect(-length / 2 - 1, -width / 2 + 3, 3, 4);
    ctx.fillRect(-length / 2 - 1, width / 2 - 7, 3, 4);

    // 9. Nitro & Mini-Turbo Exhaust Flames
    const isTurboActive = car.nitroActive || car.miniTurboBoostTimer > 0;
    if (isTurboActive) {
      const isUltra = car.miniTurboBoostTimer > 0 && car.miniTurboLevel === 2;
      const flameLen = 16 + Math.sin(time * 45) * 10;
      const flameColor = isUltra ? '#c084fc' : car.miniTurboBoostTimer > 0 ? '#38bdf8' : '#00f0ff';

      ctx.fillStyle = flameColor;
      ctx.beginPath();
      ctx.moveTo(-length / 2 - 2, -6);
      ctx.lineTo(-length / 2 - 2 - flameLen, -3);
      ctx.lineTo(-length / 2 - 2, 0);
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(-length / 2 - 2, 0);
      ctx.lineTo(-length / 2 - 2 - flameLen, 3);
      ctx.lineTo(-length / 2 - 2, 6);
      ctx.fill();
    }

    // 10. Mini-Turbo Drift Sparks at Rear Tires
    if (car.isDrifting && car.miniTurboLevel > 0) {
      const sparkColor = car.miniTurboLevel === 2 ? '#d946ef' : '#06b6d4';
      ctx.fillStyle = sparkColor;

      for (let s = 0; s < 3; s++) {
        const ox = (Math.random() - 0.5) * 12;
        const oy = (Math.random() - 0.5) * 8;
        ctx.beginPath();
        ctx.arc(-length / 2 + 6 + ox, -width / 2 - 4 + oy, 3, 0, Math.PI * 2);
        ctx.arc(-length / 2 + 6 + ox, width / 2 + 4 + oy, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();

    // 11. Labels, Badges & AI Emote Bubbles (Un-rotated above the car)
    ctx.save();
    ctx.translate(car.x, car.y - 28);

    if (car.isPlayer) {
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.moveTo(-6, -6);
      ctx.lineTo(6, -6);
      ctx.lineTo(0, 0);
      ctx.closePath();
      ctx.fill();

      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffffff';
      ctx.fillText('YOU', 0, -10);
    } else {
      ctx.font = '10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.fillText(car.name, 0, -4);

      if (car.aiEmote && car.aiEmote.timer > 0) {
        ctx.save();
        ctx.translate(0, -22);
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(-24, -14, 48, 16, 5);
        ctx.fill();
        ctx.stroke();

        ctx.font = 'bold 9px system-ui, sans-serif';
        ctx.fillStyle = '#dc2626';
        ctx.fillText(car.aiEmote.text, 0, -3);
        ctx.restore();
      }
    }
    ctx.restore();
  }

  private drawFloatingNotifications(notifications: FloatingNotification[]) {
    const ctx = this.ctx;
    for (const notif of notifications) {
      ctx.save();
      ctx.translate(notif.x, notif.y);
      ctx.scale(notif.scale, notif.scale);
      ctx.globalAlpha = notif.alpha;

      ctx.font = '900 15px system-ui, sans-serif';
      ctx.textAlign = 'center';

      ctx.strokeStyle = '#090a0f';
      ctx.lineWidth = 4;
      ctx.strokeText(notif.text, 0, 0);

      ctx.fillStyle = notif.color;
      ctx.fillText(notif.text, 0, 0);

      if (notif.subtext) {
        ctx.font = 'bold 11px system-ui, sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(notif.subtext, 0, 14);
      }

      ctx.restore();
    }
    ctx.globalAlpha = 1.0;
  }

  private drawWeatherOverlay(
    weather: TrackWeather,
    vpWidth: number,
    vpHeight: number,
    time: number
  ) {
    if (weather === 'clear') return;
    const ctx = this.ctx;
    ctx.save();

    if (weather === 'night') {
      const radial = ctx.createRadialGradient(
        vpWidth / 2,
        vpHeight / 2,
        Math.min(vpWidth, vpHeight) * 0.22,
        vpWidth / 2,
        vpHeight / 2,
        Math.max(vpWidth, vpHeight) * 0.72
      );
      radial.addColorStop(0, 'rgba(9, 10, 20, 0.08)');
      radial.addColorStop(1, 'rgba(3, 5, 14, 0.55)');
      ctx.fillStyle = radial;
      ctx.fillRect(0, 0, vpWidth, vpHeight);
    } else if (weather === 'rain') {
      ctx.strokeStyle = 'rgba(148, 197, 255, 0.35)';
      ctx.lineWidth = 1.5;
      const drops = 32;
      for (let i = 0; i < drops; i++) {
        const seed = i * 97.3;
        const x = ((seed + time * 260) % (vpWidth + 80)) - 40;
        const y = ((seed * 1.7 + time * 680) % (vpHeight + 80)) - 40;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - 10, y + 24);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  private drawSpeedLines(
    playerCar: CarEntity,
    vpWidth: number,
    vpHeight: number,
    time: number
  ) {
    const ctx = this.ctx;
    const isHighSpeed = playerCar.speed > 340 || playerCar.nitroActive || playerCar.miniTurboBoostTimer > 0;
    if (!isHighSpeed) return;

    ctx.save();
    const cx = vpWidth / 2;
    const cy = vpHeight / 2;
    const lineCount = 18;
    const intensity = Math.min(1.0, (playerCar.speed - 300) / 140);

    ctx.strokeStyle = playerCar.nitroActive ? '#38bdf8' : '#ffffff';
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.35 * intensity;

    for (let i = 0; i < lineCount; i++) {
      const angle = (i / lineCount) * Math.PI * 2 + Math.sin(time * 12 + i) * 0.1;
      const minRadius = Math.min(vpWidth, vpHeight) * 0.38;
      const maxRadius = Math.max(vpWidth, vpHeight) * 0.65;

      const x1 = cx + Math.cos(angle) * minRadius;
      const y1 = cy + Math.sin(angle) * minRadius;
      const x2 = cx + Math.cos(angle) * maxRadius;
      const y2 = cy + Math.sin(angle) * maxRadius;

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    ctx.restore();
  }
}
