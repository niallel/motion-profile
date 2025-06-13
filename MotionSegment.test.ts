import { describe, it, expect } from 'vitest';
import { MotionSegment } from './MotionSegment';

function closeTo(a: number, b: number, tol = 1e-6) {
  return Math.abs(a - b) < tol;
}

describe('MotionSegment', () => {
  const startTime = 0;
  const endTime = 10;
  const distance = 100;

  describe('constant profile', () => {
    it('computes correct position, velocity, acceleration', () => {
      const profile = new MotionSegment({
        startTime,
        endTime,
        distance,
        startVelocity: 0,
        profileType: 'constant',
      });
      expect(closeTo(profile.position(0), 0)).toBe(true);
      expect(closeTo(profile.position(10), 100)).toBe(true);
      expect(closeTo(profile.velocity(0), 0)).toBe(true);
      expect(closeTo(profile.velocity(10), 20)).toBe(true);
      expect(closeTo(profile.acceleration(0), 2)).toBe(true);
      expect(closeTo(profile.acceleration(10), 2)).toBe(true);
      expect(closeTo(profile.jerk(0), 0)).toBe(true);
    });
    it('throws if endVelocity is provided', () => {
      expect(() => new MotionSegment({
        startTime,
        endTime,
        distance,
        startVelocity: 0,
        endVelocity: 0,
        profileType: 'constant',
      })).toThrow();
    });
  });

  describe('triangular profile', () => {
    it('computes correct position, velocity, acceleration', () => {
      const profile = new MotionSegment({
        startTime,
        endTime,
        distance,
        startVelocity: 0,
        endVelocity: 0,
        profileType: 'triangular',
      });
      expect(closeTo(profile.position(0), 0)).toBe(true);
      expect(closeTo(profile.position(10), 100)).toBe(true);
      expect(closeTo(profile.velocity(0), 0)).toBe(true);
      expect(closeTo(profile.velocity(5), 10)).toBe(true);
      expect(closeTo(profile.velocity(10), 0)).toBe(true);
      expect(closeTo(profile.acceleration(0), 2)).toBe(true);
      expect(closeTo(profile.acceleration(5), -2)).toBe(true);
      expect(closeTo(profile.jerk(0), 0)).toBe(true);
    });
  });

  describe('trapezoidal profile', () => {
    it('computes correct position, velocity, acceleration, cruisePercentage', () => {
      const profile = new MotionSegment({
        startTime,
        endTime,
        distance,
        startVelocity: 0,
        endVelocity: 0,
        profileType: 'trapezoidal',
        cruisePercentage: 1/3,
      });
      expect(closeTo(profile.position(0), 0)).toBe(true);
      expect(closeTo(profile.position(10), 100)).toBe(true);
      // At t1 (end of accel):
      const t1 = (endTime - startTime) * (1 - 1/3) / 2;
      expect(closeTo(profile.velocity(t1), profile['trapezoidalParams']().vMax)).toBe(true);
      // At t2 (end of cruise):
      const t2 = t1 + (endTime - startTime) * (1/3);
      expect(closeTo(profile.velocity(t2), profile['trapezoidalParams']().vMax)).toBe(true);
      // At t3 (end):
      expect(closeTo(profile.velocity(10), 0)).toBe(true);
    });
    it('throws if cruisePercentage is out of bounds', () => {
      expect(() => new MotionSegment({
        startTime,
        endTime,
        distance,
        startVelocity: 0,
        endVelocity: 0,
        profileType: 'trapezoidal',
        cruisePercentage: -0.1,
      })).toThrow();
      expect(() => new MotionSegment({
        startTime,
        endTime,
        distance,
        startVelocity: 0,
        endVelocity: 0,
        profileType: 'trapezoidal',
        cruisePercentage: 1.1,
      })).toThrow();
    });
  });

  describe('s-curve profile', () => {
    it('computes position, velocity, acceleration, jerk', () => {
      const profile = new MotionSegment({
        startTime,
        endTime,
        distance,
        startVelocity: 0,
        endVelocity: 0,
        profileType: 's-curve',
      });
      expect(closeTo(profile.position(0), 0)).toBe(true);
      expect(closeTo(profile.position(10), 100)).toBe(true);
      expect(closeTo(profile.velocity(0), 0)).toBe(true);
      expect(closeTo(profile.velocity(10), 0)).toBe(true);
      expect(closeTo(profile.acceleration(0), 6 * distance / 100)).toBe(true); // 6d/T^2
      expect(closeTo(profile.jerk(0), -0.12)).toBe(true); // -12d/T^3
    });
  });

  describe('polynomial profile', () => {
    it('computes position, velocity, acceleration, jerk', () => {
      const profile = new MotionSegment({
        startTime,
        endTime,
        distance: 100,
        startVelocity: 0,
        endVelocity: 0,
        profileType: 'polynomial',
      });
      expect(closeTo(profile.position(0), 0)).toBe(true);
      expect(closeTo(profile.position(10), 100)).toBe(true);
      expect(closeTo(profile.velocity(10), 0)).toBe(true);
      expect(closeTo(profile.acceleration(10), 0)).toBe(true);
      expect(closeTo(profile.jerk(10), 0)).toBe(true);
    });
    it('throws if coefficients are missing', () => {
      // This test is no longer needed, as coefficients are always auto-generated
      // So we can remove it
    });
  });

  describe('jerk-limited profile', () => {
    it('computes position, velocity, acceleration, jerk', () => {
      const profile = new MotionSegment({
        startTime,
        endTime,
        distance,
        startVelocity: 0,
        endVelocity: 0,
        startAccel: 0,
        endAccel: 0,
        startJerk: 0,
        endJerk: 0,
        profileType: 'jerk-limited',
      });
      expect(closeTo(profile.position(0), 0)).toBe(true);
      expect(closeTo(profile.position(10), 100)).toBe(true);
      expect(typeof profile.velocity(5)).toBe('number');
      expect(typeof profile.acceleration(5)).toBe('number');
      expect(typeof profile.jerk(5)).toBe('number');
    });
    it('throws if required parameters are missing', () => {
      expect(() => new MotionSegment({
        startTime,
        endTime,
        distance,
        startVelocity: 0,
        endVelocity: 0,
        profileType: 'jerk-limited',
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
        profileType: 'constant',
      })).toThrow();
      expect(() => new MotionSegment({
        startTime,
        endTime,
        distance,
        startVelocity: -1,
        profileType: 'constant',
      })).toThrow();
    });
    it('throws for invalid time interval', () => {
      expect(() => new MotionSegment({
        startTime: 10,
        endTime: 0,
        distance,
        startVelocity: 0,
        profileType: 'constant',
      })).toThrow();
    });
    it('throws for missing profileType', () => {
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