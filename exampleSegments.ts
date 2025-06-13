import { MotionSegment } from './MotionSegment';
import { plot } from 'nodeplotlib';

const startTime = 0;
const endTime = 10;
const distance = 100;
const steps = 100;

// Segments
const constantSegment = new MotionSegment({
  startTime,
  endTime,
  distance,
  startVelocity: 0,
  segmentType: 'constant',
});

const triangularSegment = new MotionSegment({
  startTime,
  endTime,
  distance,
  startVelocity: 0,
  endVelocity: 0,
  segmentType: 'triangular',
});

const trapezoidalSegment = new MotionSegment({
  startTime,
  endTime,
  distance,
  startVelocity: 0,
  endVelocity: 0,
  cruisePercentage: 1/3,
  segmentType: 'trapezoidal',
});

const sCurveSegment = new MotionSegment({
  startTime,
  endTime,
  distance,
  startVelocity: 0,
  endVelocity: 0,
  segmentType: 's-curve',
});

const polynomialSegment = new MotionSegment({
  startTime,
  endTime,
  distance, 
  startVelocity: 0,
  endVelocity: 0,
  startAccel: 0, // include for 5th degree polynomial (quintic), otherwise its a 3rd degree polynomial (cubic)
  endAccel: 0, // include for 5th degree polynomial (quintic), otherwise its a 3rd degree polynomial (cubic)
  segmentType: 'polynomial',
});

const jerkLimitedSegment = new MotionSegment({
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

// Helper to sample a property
function sampleSegment(segment: MotionSegment, fn: (t: number) => number): number[][] {
  const tArr: number[] = [];
  const yArr: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = startTime + (i / steps) * (endTime - startTime);
    tArr.push(t);
    yArr.push(fn(t));
  }
  return [tArr, yArr];
}

// Plot all four properties for a single segment
function plotSegmentAllCurves(segment: MotionSegment, label: string) {
  const [tDist, distArr] = sampleSegment(segment, t => segment.position(t));
  const [tVel, velArr] = sampleSegment(segment, t => segment.velocity(t));
  const [tAcc, accArr] = sampleSegment(segment, t => segment.acceleration(t));
  const [tJerk, jerkArr] = sampleSegment(segment, t => segment.jerk(t));

  const data: any[] = [
    { x: tDist, y: distArr, type: 'scatter', mode: 'lines', name: 'Distance' },
    { x: tVel, y: velArr, type: 'scatter', mode: 'lines', name: 'Velocity' },
    { x: tAcc, y: accArr, type: 'scatter', mode: 'lines', name: 'Acceleration' },
    { x: tJerk, y: jerkArr, type: 'scatter', mode: 'lines', name: 'Jerk' },
  ];

  plot(data, {
    title: `${label} Segment: Distance, Velocity, Acceleration, Jerk`,
    xaxis: { title: 'Time (s)' },
    yaxis: { title: 'Value' },
  });
}

// Plot for each segment type
plotSegmentAllCurves(constantSegment, 'Constant');
plotSegmentAllCurves(triangularSegment, 'Triangular');
plotSegmentAllCurves(trapezoidalSegment, 'Trapezoidal');
plotSegmentAllCurves(sCurveSegment, 'S-curve');
plotSegmentAllCurves(polynomialSegment, 'Polynomial');
plotSegmentAllCurves(jerkLimitedSegment, 'Jerk-limited');

// Still print summary values
console.log('Constant Segment:', constantSegment.position(10), 'Max Accel:', constantSegment.getMaxAcceleration(), 'Max Jerk:', constantSegment.getMaxJerk());
console.log('Triangular Segment:', triangularSegment.position(10), 'Max Accel:', triangularSegment.getMaxAcceleration(), 'Max Jerk:', triangularSegment.getMaxJerk());
console.log('Trapezoidal Segment:', trapezoidalSegment.position(10), 'Max Accel:', trapezoidalSegment.getMaxAcceleration(), 'Max Jerk:', trapezoidalSegment.getMaxJerk());
console.log('S-curve Segment:', sCurveSegment.position(10), 'Max Accel:', sCurveSegment.getMaxAcceleration(), 'Max Jerk:', sCurveSegment.getMaxJerk());
console.log('Polynomial Segment:', polynomialSegment.position(10), 'Max Accel:', polynomialSegment.getMaxAcceleration(), 'Max Jerk:', polynomialSegment.getMaxJerk());
console.log('Jerk-limited Segment:', jerkLimitedSegment.position(10), 'Max Accel:', jerkLimitedSegment.getMaxAcceleration(), 'Max Jerk:', jerkLimitedSegment.getMaxJerk()); 