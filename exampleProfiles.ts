import { MotionProfile } from './MotionProfile';
import { plot } from 'nodeplotlib';

const startTime = 0;
const endTime = 10;
const distance = 100;
const steps = 100;

// Profiles
const constantProfile = new MotionProfile({
  startTime,
  endTime,
  distance,
  startVelocity: 0,
  profileType: 'constant',
});

const triangularProfile = new MotionProfile({
  startTime,
  endTime,
  distance,
  startVelocity: 0,
  endVelocity: 0,
  profileType: 'triangular',
});

const trapezoidalProfile = new MotionProfile({
  startTime,
  endTime,
  distance,
  startVelocity: 0,
  endVelocity: 0,
  cruisePercentage: 1/3,
  profileType: 'trapezoidal',
});

const sCurveProfile = new MotionProfile({
  startTime,
  endTime,
  distance,
  startVelocity: 0,
  endVelocity: 0,
  profileType: 's-curve',
});

const polynomialProfile = new MotionProfile({
  startTime,
  endTime,
  distance, 
  startVelocity: 0,
  endVelocity: 0,
  profileType: 'polynomial',
});

const jerkLimitedProfile = new MotionProfile({
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

// Helper to sample a property
function sampleProfile(profile: MotionProfile, fn: (t: number) => number): number[][] {
  const tArr: number[] = [];
  const yArr: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = startTime + (i / steps) * (endTime - startTime);
    tArr.push(t);
    yArr.push(fn(t));
  }
  return [tArr, yArr];
}

// Plot all four properties for a single profile
function plotProfileAllCurves(profile: MotionProfile, label: string) {
  const [tDist, distArr] = sampleProfile(profile, t => profile.position(t));
  const [tVel, velArr] = sampleProfile(profile, t => profile.velocity(t));
  const [tAcc, accArr] = sampleProfile(profile, t => profile.acceleration(t));
  const [tJerk, jerkArr] = sampleProfile(profile, t => profile.jerk(t));

  const data: any[] = [
    { x: tDist, y: distArr, type: 'scatter', mode: 'lines', name: 'Distance' },
    { x: tVel, y: velArr, type: 'scatter', mode: 'lines', name: 'Velocity' },
    { x: tAcc, y: accArr, type: 'scatter', mode: 'lines', name: 'Acceleration' },
    { x: tJerk, y: jerkArr, type: 'scatter', mode: 'lines', name: 'Jerk' },
  ];

  plot(data, {
    title: `${label} Profile: Distance, Velocity, Acceleration, Jerk`,
    xaxis: { title: 'Time (s)' },
    yaxis: { title: 'Value' },
  });
}

// Plot for each profile type
plotProfileAllCurves(constantProfile, 'Constant');
plotProfileAllCurves(triangularProfile, 'Triangular');
plotProfileAllCurves(trapezoidalProfile, 'Trapezoidal');
plotProfileAllCurves(sCurveProfile, 'S-curve');
plotProfileAllCurves(polynomialProfile, 'Polynomial');
plotProfileAllCurves(jerkLimitedProfile, 'Jerk-limited');

// Still print summary values
console.log('Constant Profile:', constantProfile.position(10), 'Max Accel:', constantProfile.getMaxAcceleration(), 'Max Jerk:', constantProfile.getMaxJerk());
console.log('Triangular Profile:', triangularProfile.position(10), 'Max Accel:', triangularProfile.getMaxAcceleration(), 'Max Jerk:', triangularProfile.getMaxJerk());
console.log('Trapezoidal Profile:', trapezoidalProfile.position(10), 'Max Accel:', trapezoidalProfile.getMaxAcceleration(), 'Max Jerk:', trapezoidalProfile.getMaxJerk());
console.log('S-curve Profile:', sCurveProfile.position(10), 'Max Accel:', sCurveProfile.getMaxAcceleration(), 'Max Jerk:', sCurveProfile.getMaxJerk());
console.log('Polynomial Profile:', polynomialProfile.position(10), 'Max Accel:', polynomialProfile.getMaxAcceleration(), 'Max Jerk:', polynomialProfile.getMaxJerk());
console.log('Jerk-limited Profile:', jerkLimitedProfile.position(10), 'Max Accel:', jerkLimitedProfile.getMaxAcceleration(), 'Max Jerk:', jerkLimitedProfile.getMaxJerk()); 