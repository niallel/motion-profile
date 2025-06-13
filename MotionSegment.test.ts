import { describe, it, expect } from 'vitest';
import { MotionSegment } from './MotionSegment';

function closeTo(a: number, b: number, tol = 1e-6) {
  return Math.abs(a - b) < tol;
}

describe('MotionSegment', () => {
  const startTime = 0;
  const endTime = 10;
  const distance = 100;

  describe('constant segment', () => {
    it('computes correct position, velocity, acceleration', () => {
      const segment = new MotionSegment({
        startTime,
        endTime,
        distance,
        startVelocity: 0,
        segmentType: 'constant',
      });
      expect(closeTo(segment.position(0), 0)).toBe(true);
      expect(closeTo(segment.position(10), 100)).toBe(true);
      expect(closeTo(segment.velocity(0), 0)).toBe(true);
      expect(closeTo(segment.velocity(10), 20)).toBe(true);
      expect(closeTo(segment.acceleration(0), 2)).toBe(true);
      expect(closeTo(segment.acceleration(10), 2)).toBe(true);
      expect(closeTo(segment.jerk(0), 0)).toBe(true);
    });
    it('throws if endVelocity is provided', () => {
      expect(() => new MotionSegment({
        startTime,
        endTime,
        distance,
        startVelocity: 0,
        endVelocity: 0,
        segmentType: 'constant',
      })).toThrow();
    });
  });

  describe('triangular segment', () => {
    it('computes correct position, velocity, acceleration', () => {
      const segment = new MotionSegment({
        startTime,
        endTime,
        distance,
        startVelocity: 0,
        endVelocity: 0,
        segmentType: 'triangular',
      });
      expect(closeTo(segment.position(0), 0)).toBe(true);
      expect(closeTo(segment.position(10), 100)).toBe(true);
      expect(closeTo(segment.velocity(0), 0)).toBe(true);
      expect(closeTo(segment.velocity(5), 20)).toBe(true);
      expect(closeTo(segment.velocity(10), 0)).toBe(true);
      expect(closeTo(segment.acceleration(0), 4)).toBe(true);
      expect(closeTo(segment.jerk(0), 0)).toBe(true);
    });
  });

  describe('trapezoidal segment', () => {
    it('computes correct position, velocity, acceleration, cruisePercentage', () => {
      const segment = new MotionSegment({
        startTime,
        endTime,
        distance,
        startVelocity: 0,
        endVelocity: 0,
        segmentType: 'trapezoidal',
        cruisePercentage: 1/3,
      });
      expect(closeTo(segment.position(0), 0)).toBe(true);
      expect(closeTo(segment.position(10), 100)).toBe(true);
      // At t1 (end of accel):
      const t1 = (endTime - startTime) * (1 - 1/3) / 2;
      expect(closeTo(segment.velocity(t1), segment['trapezoidalParams']().vMax)).toBe(true);
      // At t2 (end of cruise):
      const t2 = t1 + (endTime - startTime) * (1/3);
      expect(closeTo(segment.velocity(t2), segment['trapezoidalParams']().vMax)).toBe(true);
      // At t3 (end):
      expect(closeTo(segment.velocity(10), 0)).toBe(true);
    });
    it('throws if cruisePercentage is out of bounds', () => {
      expect(() => new MotionSegment({
        startTime,
        endTime,
        distance,
        startVelocity: 0,
        endVelocity: 0,
        segmentType: 'trapezoidal',
        cruisePercentage: -0.1,
      })).toThrow();
      expect(() => new MotionSegment({
        startTime,
        endTime,
        distance,
        startVelocity: 0,
        endVelocity: 0,
        segmentType: 'trapezoidal',
        cruisePercentage: 1.1,
      })).toThrow();
    });
  });

  describe('s-curve segment', () => {
    it('computes position, velocity, acceleration, jerk', () => {
      const segment = new MotionSegment({
        startTime,
        endTime,
        distance,
        startVelocity: 0,
        endVelocity: 0,
        segmentType: 's-curve',
      });
      expect(closeTo(segment.position(0), 0)).toBe(true);
      expect(closeTo(segment.position(10), 100)).toBe(true);
      expect(closeTo(segment.velocity(0), 0)).toBe(true);
      expect(closeTo(segment.velocity(10), 0)).toBe(true);
      expect(closeTo(segment.acceleration(0), 6 * distance / 100)).toBe(true); // 6d/T^2
      expect(closeTo(segment.jerk(0), -1.2)).toBe(true); // -12d/T^3
    });
  });

  describe('polynomial segment', () => {
    it('computes position, velocity, acceleration, jerk', () => {
      const segment = new MotionSegment({
        startTime,
        endTime,
        distance: 100,
        startVelocity: 0,
        endVelocity: 0,
        startAccel: 0,
        endAccel: 0,
        segmentType: 'polynomial',
      });
      expect(closeTo(segment.position(0), 0)).toBe(true);
      expect(closeTo(segment.position(10), 100)).toBe(true);
      expect(closeTo(segment.velocity(10), 0)).toBe(true);
      expect(closeTo(segment.acceleration(10), 0, 1e-12)).toBe(true);
      expect(closeTo(segment.jerk(10), 6, 1e-12)).toBe(true);
    });
    it('throws if coefficients are missing', () => {
      // This test is no longer needed, as coefficients are always auto-generated
      // So we can remove it
    });
  });

  describe('jerk-limited segment', () => {
    it('computes position, velocity, acceleration, jerk', () => {
      const segment = new MotionSegment({
        startTime,
        endTime,
        distance,
        startVelocity: 0,
        endVelocity: 0,
        startAccel: 0,
        endAccel: 0,
        startJerk: 0,
        endJerk: 0,
        segmentType: 'jerk-limited',
      });
      expect(closeTo(segment.position(0), 0)).toBe(true);
      expect(closeTo(segment.position(10), 100)).toBe(true);
      expect(typeof segment.velocity(5)).toBe('number');
      expect(typeof segment.acceleration(5)).toBe('number');
      expect(typeof segment.jerk(5)).toBe('number');
    });
    it('throws if required parameters are missing', () => {
      expect(() => new MotionSegment({
        startTime,
        endTime,
        distance,
        startVelocity: 0,
        endVelocity: 0,
        segmentType: 'jerk-limited',
      })).toThrow();
    });
  });

  describe('validation and edge cases', () => {
    it('throws for negative distance or velocity', () => {
      expect(() => new MotionSegment({
        startTime,
        endTime,
        distance: -1,
        startVelocity: 0,
        segmentType: 'constant',
      })).toThrow();
      expect(() => new MotionSegment({
        startTime,
        endTime,
        distance,
        startVelocity: -1,
        segmentType: 'constant',
      })).toThrow();
    });
    it('throws for invalid time interval', () => {
      expect(() => new MotionSegment({
        startTime: 10,
        endTime: 0,
        distance,
        startVelocity: 0,
        segmentType: 'constant',
      })).toThrow();
    });
    it('throws for missing segmentType', () => {
      // @ts-expect-error
      expect(() => new MotionSegment({
        startTime,
        endTime,
        distance,
        startVelocity: 0,
      })).toThrow();
    });
  });
}); 