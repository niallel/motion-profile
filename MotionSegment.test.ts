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
    it('allows negative startAccel and endAccel for jerk-limited', () => {
      expect(() => new MotionSegment({
        startTime,
        endTime,
        distance,
        startVelocity: 0,
        endVelocity: 0,
        startAccel: -2,
        endAccel: -3,
        startJerk: 0,
        endJerk: 0,
        segmentType: 'jerk-limited',
      })).not.toThrow();
    });
    it('allows negative startJerk and endJerk for jerk-limited', () => {
      expect(() => new MotionSegment({
        startTime,
        endTime,
        distance,
        startVelocity: 0,
        endVelocity: 0,
        startAccel: 0,
        endAccel: 0,
        startJerk: -1,
        endJerk: -2,
        segmentType: 'jerk-limited',
      })).not.toThrow();
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

  describe('validation of input properties', () => {
    const base = {
      startTime: 0,
      endTime: 10,
      distance: 100,
      startVelocity: 0,
      segmentType: 'constant' as const,
    };

    it('throws if startTime is missing', () => {
      // @ts-expect-error
      expect(() => new MotionSegment({ ...base, startTime: undefined })).toThrow('startTime and endTime must be numbers');
    });
    it('throws if endTime is missing', () => {
      // @ts-expect-error
      expect(() => new MotionSegment({ ...base, endTime: undefined })).toThrow('startTime and endTime must be numbers');
    });
    it('throws if distance is missing', () => {
      // @ts-expect-error
      expect(() => new MotionSegment({ ...base, distance: undefined })).toThrow('distance must be a number');
    });
    it('throws if startVelocity is missing', () => {
      // @ts-expect-error
      expect(() => new MotionSegment({ ...base, startVelocity: undefined })).toThrow('startVelocity must be a number');
    });
    it('throws if segmentType is missing', () => {
      // @ts-expect-error
      expect(() => new MotionSegment({ ...base, segmentType: undefined })).toThrow('segmentType is required');
    });
    it('throws if startTime >= endTime', () => {
      expect(() => new MotionSegment({ ...base, startTime: 10, endTime: 10 })).toThrow('startTime must be less than endTime');
    });
    it('throws if endVelocity is provided for constant', () => {
      expect(() => new MotionSegment({ ...base, endVelocity: 0 })).toThrow('endVelocity should not be provided for constant segment');
    });
    it('throws if cruisePercentage is out of bounds for trapezoidal', () => {
      expect(() => new MotionSegment({ ...base, segmentType: 'trapezoidal', cruisePercentage: -0.1 })).toThrow('cruisePercentage must be between 0 and 1 for trapezoidal segments');
      expect(() => new MotionSegment({ ...base, segmentType: 'trapezoidal', cruisePercentage: 1.1 })).toThrow('cruisePercentage must be between 0 and 1 for trapezoidal segments');
    });
    it('throws if jerk-limited is missing startAccel/endAccel/startJerk/endJerk', () => {
      expect(() => new MotionSegment({ ...base, segmentType: 'jerk-limited' })).toThrow('startAccel and endAccel are required for jerk-limited segment');
      expect(() => new MotionSegment({ ...base, segmentType: 'jerk-limited', startAccel: 0, endAccel: 0 })).toThrow('startJerk and endJerk are required for jerk-limited segment');
    });
  });

  describe('expanded validation and edge cases', () => {
    const base = {
      startTime: 0,
      endTime: 10,
      distance: 100,
      startVelocity: 0,
      segmentType: 'triangular' as const,
      endVelocity: 0,
    };
    it('throws if endVelocity is missing for triangular', () => {
      expect(() => new MotionSegment({ ...base, endVelocity: undefined })).toThrow('endVelocity must be a number for triangular segment');
    });
    it('throws if distance is too short for triangular', () => {
      expect(() => new MotionSegment({ ...base, distance: 1e-8 })).toThrow();
    });
    it('throws if duration is too short for triangular', () => {
      expect(() => new MotionSegment({ ...base, endTime: 1e-8 })).toThrow();
    });
    it('throws if cruisePercentage is not a number for trapezoidal', () => {
      expect(() => new MotionSegment({ ...base, segmentType: 'trapezoidal', cruisePercentage: 'foo' as any })).toThrow('cruisePercentage must be a number for trapezoidal segments');
    });
    it('throws if cruisePercentage is exactly 0 or 1 for trapezoidal', () => {
      expect(() => new MotionSegment({ ...base, segmentType: 'trapezoidal', cruisePercentage: 0 })).toThrow();
      expect(() => new MotionSegment({ ...base, segmentType: 'trapezoidal', cruisePercentage: 1 })).toThrow();
    });
    it('throws if duration is zero', () => {
      expect(() => new MotionSegment({ ...base, endTime: 0 })).toThrow('startTime must be less than endTime');
    });
    it('throws if distance is zero (if not allowed)', () => {
      expect(() => new MotionSegment({ ...base, distance: 0 })).toThrow();
    });
    it('throws if any parameter is NaN or Infinity', () => {
      expect(() => new MotionSegment({ ...base, startTime: NaN })).toThrow();
      expect(() => new MotionSegment({ ...base, endTime: Infinity })).toThrow();
      expect(() => new MotionSegment({ ...base, distance: NaN })).toThrow();
      expect(() => new MotionSegment({ ...base, startVelocity: Infinity })).toThrow();
    });
    it('ignores or throws for extra/unknown properties', () => {
      expect(() => new MotionSegment({ ...base, foo: 123 } as any)).not.toThrow(); // Should ignore
    });
    it('accepts boundary values for cruisePercentage, velocities, min distance/duration', () => {
      expect(() => new MotionSegment({ ...base, segmentType: 'trapezoidal', cruisePercentage: 0.00001 })).toThrow();
      expect(() => new MotionSegment({ ...base, startVelocity: 0, endVelocity: 0 })).not.toThrow();
      expect(() => new MotionSegment({ ...base, distance: 0.00001 })).toThrow();
      expect(() => new MotionSegment({ ...base, endTime: 0.00001 })).not.toThrow();
    });
    it('accepts very large and very small (but valid) values', () => {
      expect(() => new MotionSegment({ ...base, distance: 1e12, endTime: 1e6 })).not.toThrow();
      expect(() => new MotionSegment({ ...base, distance: 1e-6, endTime: 1e-3 })).not.toThrow();
    });
  });
}); 