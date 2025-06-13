/**
 * Supported motion segment types.
 */
type SegmentType =
    | 'constant'      // Constant acceleration
    | 'triangular'    // Symmetric acceleration/deceleration (peak at midpoint)
    | 'trapezoidal'   // Accel, cruise, decel
    | 's-curve'       // Cubic S-curve
    | 'polynomial'    // Arbitrary polynomial
    | 'jerk-limited'; // 7th-order jerk-limited S-curve

/**
 * Options for constructing a MotionSegment.
 * @property {number} startTime - The start time of the segment.
 * @property {number} endTime - The end time of the segment.
 * @property {number} distance - The total distance to travel.
 * @property {number} startVelocity - The initial velocity.
 * @property {number} [endVelocity] - The final velocity (default: startVelocity).
 * @property {number} [startAccel] - The initial acceleration (for jerk-limited/polynomial).
 * @property {number} [endAccel] - The final acceleration (for jerk-limited/polynomial).
 * @property {number} [startJerk] - The initial jerk (for jerk-limited/polynomial).
 * @property {number} [endJerk] - The final jerk (for jerk-limited/polynomial).
 * @property {SegmentType} segmentType - The type of motion segment.
 * @property {number[]} [polynomialCoefficients] - Coefficients for polynomial segment.
 * @property {number} [cruisePercentage] - The percentage (0-1) of the total time to spend in the cruise phase (for trapezoidal).
 */
interface MotionSegmentOptions {
    startTime: number;
    endTime: number;
    distance: number;
    startVelocity: number;
    endVelocity?: number;
    startAccel?: number;
    endAccel?: number;
    startJerk?: number;
    endJerk?: number;
    segmentType: SegmentType;
    /**
     * The percentage (0-1) of the total time to spend in the cruise phase (for trapezoidal).
     * If provided, automatically solves for the required cruise velocity.
     */
    cruisePercentage?: number;
}

/**
 * MotionSegment generates position, velocity, acceleration, and jerk segments
 * for a variety of motion types (constant, triangular, trapezoidal, s-curve, polynomial, jerk-limited).
 */
export class MotionSegment {
    private readonly t0: number; // Start time
    private readonly t1: number; // End time
    private readonly d: number;  // Distance
    private readonly v0: number; // Start velocity
    private readonly vf: number; // End velocity
    private readonly a0: number; // Start acceleration
    private readonly af: number; // End acceleration
    private readonly j0: number; // Start jerk
    private readonly jf: number; // End jerk
    private readonly type: SegmentType; // Segment type
    private readonly coeffs?: number[]; // Polynomial coefficients (now always auto-calculated)
    private jerkCoeffs?: number[];      // Jerk-limited coefficients
    private readonly cruisePercentage?: number; // Fraction of time for cruise phase

    /**
     * Validate the options for constructing a MotionSegment.
     * Throws an error if any parameter is invalid.
     * @private
     * @param {MotionSegmentOptions} opts - The options to validate.
     */
    private validateOptions(opts: MotionSegmentOptions): void {
        // Check required fields
        if (typeof opts.startTime !== 'number' || typeof opts.endTime !== 'number') {
            throw new Error('startTime and endTime must be numbers');
        }
        if (typeof opts.distance !== 'number' || isNaN(opts.distance)) {
            throw new Error('distance must be a number');
        }
        if (typeof opts.startVelocity !== 'number' || isNaN(opts.startVelocity)) {
            throw new Error('startVelocity must be a number');
        }
        if (!opts.segmentType) {
            throw new Error('segmentType is required');
        }

        // Check time interval
        if (opts.startTime >= opts.endTime) {
            throw new Error('startTime must be less than endTime');
        }

        // Check bounds
        if (opts.distance < 0) {
            throw new Error('distance must be non-negative');
        }
        if (opts.startVelocity < 0) {
            throw new Error('startVelocity must be non-negative');
        }
        if (opts.segmentType === 'constant' && opts.endVelocity !== undefined) {
            throw new Error('endVelocity should not be provided for constant segment');
        }
        if (opts.segmentType !== 'constant' && opts.endVelocity !== undefined && opts.endVelocity < 0) {
            throw new Error('endVelocity must be non-negative');
        }

        // Segment-specific requirements
        switch (opts.segmentType) {
            case 'jerk-limited':
                if (opts.startAccel === undefined || opts.endAccel === undefined) {
                    throw new Error('startAccel and endAccel are required for jerk-limited segment');
                }
                if (opts.startJerk === undefined || opts.endJerk === undefined) {
                    throw new Error('startJerk and endJerk are required for jerk-limited segment');
                }
                break;
        }

        if (opts.segmentType === 'trapezoidal') {
            if (opts.cruisePercentage !== undefined && (opts.cruisePercentage < 0 || opts.cruisePercentage > 1)) {
                throw new Error('cruisePercentage must be between 0 and 1 for trapezoidal segments');
            }
        }
    }

    /**
     * Construct a new MotionSegment.
     * @param {MotionSegmentOptions} opts - The options for the segment.
     */
    constructor(opts: MotionSegmentOptions) {
        this.validateOptions(opts);
        this.t0 = opts.startTime;
        this.t1 = opts.endTime;
        this.d = opts.distance;
        this.v0 = opts.startVelocity;
        this.type = opts.segmentType;
        if (this.type === 'constant') {
            // For constant segment, ignore endVelocity and solve for constant acceleration
            // such that the object travels distance d in time T starting from v0
            // s = v0*T + 0.5*a*T^2 => a = 2*(d - v0*T)/T^2
            this.vf = undefined as any;
            this.a0 = 2 * (this.d - this.v0 * (this.t1 - this.t0)) / Math.pow(this.t1 - this.t0, 2);
            this.af = this.a0;
        } else {
            this.vf = opts.endVelocity ?? opts.startVelocity;
            this.a0 = opts.startAccel ?? 0;
            this.af = opts.endAccel ?? 0;
        }
        this.j0 = opts.startJerk ?? 0;
        this.jf = opts.endJerk ?? 0;
        this.cruisePercentage = opts.cruisePercentage;
        if (this.type === 'polynomial') {
            // Automatically calculate coefficients for cubic or quintic polynomial
            const T = this.t1 - this.t0;
            const s0 = 0;
            const s1 = this.d;
            const v0 = this.v0;
            const v1 = this.vf;
            const a0 = opts.startAccel;
            const a1 = opts.endAccel;
            if (a0 !== undefined && a1 !== undefined) {
                // Quintic: match position, velocity, acceleration at endpoints
                // s(t) = a0 + a1*t + a2*t^2 + a3*t^3 + a4*t^4 + a5*t^5
                // 6 equations for 6 unknowns
                const M = [
                    [1, 0, 0, 0, 0, 0], // s(0)
                    [0, 1, 0, 0, 0, 0], // s'(0)
                    [0, 0, 2, 0, 0, 0], // s''(0)
                    [1, T, T**2, T**3, T**4, T**5], // s(T)
                    [0, 1, 2*T, 3*T**2, 4*T**3, 5*T**4], // s'(T)
                    [0, 0, 2, 6*T, 12*T**2, 20*T**3], // s''(T)
                ];
                const b = [s0, v0, a0, s1, v1, a1];
                this.coeffs = solveLinearSystem(M, b);
            } else {
                // Cubic: match position, velocity at endpoints
                // s(t) = a0 + a1*t + a2*t^2 + a3*t^3
                // 4 equations for 4 unknowns
                const M = [
                    [1, 0, 0, 0], // s(0)
                    [0, 1, 0, 0], // s'(0)
                    [1, T, T**2, T**3], // s(T)
                    [0, 1, 2*T, 3*T**2], // s'(T)
                ];
                const b = [s0, v0, s1, v1];
                this.coeffs = solveLinearSystem(M, b);
            }
        }
        if (this.type === 'jerk-limited') {
            this.jerkCoeffs = this.calcJerkLimitedCoeffs();
        }
    }

    // --- Public API ---

    /**
     * Get the position at time t.
     * @param {number} t - The time.
     * @returns {number} The position at time t.
     */
    public position(t: number): number {
        switch (this.type) {
            case 'constant':
                return this.constantPosition(t);
            case 'triangular':
                return this.triangularPosition(t);
            case 'trapezoidal':
                return this.trapezoidalPosition(t);
            case 's-curve':
                return this.sCurvePosition(t);
            case 'polynomial':
                return this.polynomialPosition(t);
            case 'jerk-limited':
                return this.jerkLimitedPosition(t);
            default:
                throw new Error('Unknown segment type');
        }
    }

    /**
     * Get the velocity at time t.
     * @param {number} t - The time.
     * @returns {number} The velocity at time t.
     */
    public velocity(t: number): number {
        switch (this.type) {
            case 'constant':
                return this.constantVelocity(t);
            case 'triangular':
                return this.triangularVelocity(t);
            case 'trapezoidal':
                return this.trapezoidalVelocity(t);
            case 's-curve':
                return this.sCurveVelocity(t);
            case 'polynomial':
                return this.polynomialVelocity(t);
            case 'jerk-limited':
                return this.jerkLimitedVelocity(t);
            default:
                throw new Error('Unknown segment type');
        }
    }

    /**
     * Get the acceleration at time t.
     * @param {number} t - The time.
     * @returns {number} The acceleration at time t.
     */
    public acceleration(t: number): number {
        switch (this.type) {
            case 'constant':
                return this.constantAcceleration(t);
            case 'triangular':
                return this.triangularAcceleration(t);
            case 'trapezoidal':
                return this.trapezoidalAcceleration(t);
            case 's-curve':
                return this.sCurveAcceleration(t);
            case 'polynomial':
                return this.polynomialAcceleration(t);
            case 'jerk-limited':
                return this.jerkLimitedAcceleration(t);
            default:
                throw new Error('Unknown segment type');
        }
    }

    /**
     * Get the jerk at time t.
     * @param {number} t - The time.
     * @returns {number} The jerk at time t.
     */
    public jerk(t: number): number {
        switch (this.type) {
            case 'polynomial':
                return this.polynomialJerk(t);
            case 'jerk-limited':
                return this.jerkLimitedJerk(t);
            case 's-curve':
                return this.sCurveJerk(t);
            default:
                return 0;
        }
    }

    /**
     * Get the maximum absolute acceleration reached in the segment.
     * @returns {number} The maximum absolute acceleration.
     */
    public getMaxAcceleration(): number {
        // Sample the acceleration at 100 points between t0 and t1
        let maxA = 0;
        const steps = 100;
        for (let i = 0; i <= steps; i++) {
            const t = this.t0 + (i / steps) * (this.t1 - this.t0);
            const a = Math.abs(this.acceleration(t));
            if (a > maxA) maxA = a;
        }
        return maxA;
    }

    /**
     * Get the maximum absolute jerk reached in the segment.
     * @returns {number} The maximum absolute jerk.
     */
    public getMaxJerk(): number {
        // Sample the jerk at 100 points between t0 and t1
        let maxJ = 0;
        const steps = 100;
        for (let i = 0; i <= steps; i++) {
            const t = this.t0 + (i / steps) * (this.t1 - this.t0);
            const j = Math.abs(this.jerk(t));
            if (j > maxJ) maxJ = j;
        }
        return maxJ;
    }

    // --- Constant acceleration ---

    /**
     * Position for constant acceleration segment.
     * @private
     * @param {number} t - The time.
     * @returns {number} The position at time t.
     */
    private constantPosition(t: number): number {
        let dt = this.clampDt(t);
        const T = this.t1 - this.t0;
        // Use the solved a0 for constant segment
        return this.v0 * dt + 0.5 * this.a0 * dt * dt;
    }

    /**
     * Velocity for constant acceleration segment.
     * @private
     * @param {number} t - The time.
     * @returns {number} The velocity at time t.
     */
    private constantVelocity(t: number): number {
        let dt = this.clampDt(t);
        // Use the solved a0 for constant segment
        return this.v0 + this.a0 * dt;
    }

    /**
     * Acceleration for constant acceleration segment.
     * @private
     * @param {number} t - The time.
     * @returns {number} The acceleration at time t.
     */
    private constantAcceleration(t: number): number {
        // Use the solved a0 for constant segment
        return this.a0;
    }

    // --- Triangular segment (symmetric accel-decel, peak at midpoint) ---

    /**
     * Calculate parameters for a symmetric triangular segment.
     * @private
     * @returns {{a: number, t1: number, vPeak: number}} The acceleration, midpoint time, and peak velocity.
     */
    private triangularParams() {
        // Simplified solution for symmetric triangular, assumes v0 = vf = 0
        const T = this.t1 - this.t0;
        const vPeak = (2 * this.d) / T;
        const t1 = T / 2;
        const a = vPeak / t1;
        return { a, t1, vPeak };
    }

    /**
     * Position for triangular segment.
     * @private
     * @param {number} t - The time.
     * @returns {number} The position at time t.
     */
    private triangularPosition(t: number): number {
        let dt = this.clampDt(t);
        const { a, t1, vPeak } = this.triangularParams();
        if (dt < t1) {
            return this.v0 * dt + 0.5 * a * dt * dt;
        } else {
            const d1 = this.v0 * t1 + 0.5 * a * t1 * t1;
            const decel = -a;
            const dt2 = dt - t1;
            return d1 + vPeak * dt2 + 0.5 * decel * dt2 * dt2;
        }
    }

    /**
     * Velocity for triangular segment.
     * @private
     * @param {number} t - The time.
     * @returns {number} The velocity at time t.
     */
    private triangularVelocity(t: number): number {
        let dt = this.clampDt(t);
        const { a, t1, vPeak } = this.triangularParams();
        if (dt < t1) {
            return this.v0 + a * dt;
        } else {
            const decel = -a;
            const dt2 = dt - t1;
            return vPeak + decel * dt2;
        }
    }

    /**
     * Acceleration for triangular segment.
     * @private
     * @param {number} t - The time.
     * @returns {number} The acceleration at time t.
     */
    private triangularAcceleration(t: number): number {
        let dt = this.clampDt(t);
        const { a, t1 } = this.triangularParams();
        return dt < t1 ? a : -a;
    }

    // --- Trapezoidal segment (accel, cruise, decel) ---

    /**
     * Calculate parameters for a trapezoidal segment.
     * If cruisePercentage is provided, use it to set the cruise phase duration and solve for vMax.
     * Otherwise, solve for the minimum required value.
     * @private
     * @returns {{vMax: number, t1: number, t2: number, t3: number, a1: number, a3: number}} The cruise velocity, phase times, and accelerations.
     */
    private trapezoidalParams() {
        const T = this.t1 - this.t0;
        const v0 = this.v0, vf = this.vf, d = this.d;
        if (this.cruisePercentage !== undefined) {
            // Clamp cruisePercentage to [0, 1]
            const cruiseFrac = Math.max(0, Math.min(1, this.cruisePercentage));
            const t2 = cruiseFrac * T;
            const t1 = (T - t2) / 2;
            const t3 = (T - t2) / 2;
            // d = (t1/2)*(v0 + vMax) + t2*vMax + (t3/2)*(vMax + vf)
            // Solve for vMax
            const vMax = (d - (t1 / 2) * v0 - (t3 / 2) * vf) / ((t1 / 2) + t2 + (t3 / 2));
            const a1 = (vMax - v0) / t1;
            const a3 = (vf - vMax) / t3;
            return { vMax, t1, t2, t3, a1, a3 };
        }
        // Solve for minimum required vMax (triangular or auto)
        const vMax_min = 2 * (d - (T / 4) * (v0 + vf)) / T;
        const a1 = (vMax_min - v0) / (T / 2); // symmetric accel
        const a3 = (vf - vMax_min) / (T / 2); // symmetric decel
        const t1 = (vMax_min - v0) / a1;
        const t3 = (vMax_min - vf) / Math.abs(a3); // ensure positive
        const d1 = (v0 + vMax_min) * t1 / 2;
        const d3 = (vf + vMax_min) * t3 / 2;
        const d2 = d - d1 - d3;
        let t2 = d2 / vMax_min;
        if (t2 < 0) {
            // Triangular segment: peak velocity is less than vMax_min, no cruise
            const vPeak = vMax_min;
            const t1_tri = T / 2;
            const t3_tri = T / 2;
            const t2_tri = 0;
            const a1_tri = (vPeak - v0) / t1_tri;
            const a3_tri = (vf - vPeak) / t3_tri;
            return { vMax: vPeak, t1: t1_tri, t2: t2_tri, t3: t3_tri, a1: a1_tri, a3: a3_tri };
        } else {
            // Trapezoidal segment with cruise
            return { vMax: vMax_min, t1, t2, t3, a1, a3 };
        }
    }

    /**
     * Position for trapezoidal segment.
     * @private
     * @param {number} t - The time.
     * @returns {number} The position at time t.
     */
    private trapezoidalPosition(t: number): number {
        let dt = this.clampDt(t);
        const { vMax, t1, t2, t3, a1, a3 } = this.trapezoidalParams();
        if (dt < t1) {
            return this.v0 * dt + 0.5 * a1 * dt * dt;
        } else if (dt < t1 + t2) {
            const d1 = this.v0 * t1 + 0.5 * a1 * t1 * t1;
            const dt2 = dt - t1;
            return d1 + vMax * dt2;
        } else {
            const d1 = this.v0 * t1 + 0.5 * a1 * t1 * t1;
            const d2 = vMax * t2;
            const dt3 = dt - t1 - t2;
            return d1 + d2 + vMax * dt3 + 0.5 * a3 * dt3 * dt3;
        }
    }

    /**
     * Velocity for trapezoidal segment.
     * @private
     * @param {number} t - The time.
     * @returns {number} The velocity at time t.
     */
    private trapezoidalVelocity(t: number): number {
        let dt = this.clampDt(t);
        const { vMax, t1, t2, t3, a1, a3 } = this.trapezoidalParams();
        if (dt < t1) {
            return this.v0 + a1 * dt;
        } else if (dt < t1 + t2) {
            return vMax;
        } else {
            const dt3 = dt - t1 - t2;
            return vMax + a3 * dt3;
        }
    }

    /**
     * Acceleration for trapezoidal segment.
     * @private
     * @param {number} t - The time.
     * @returns {number} The acceleration at time t.
     */
    private trapezoidalAcceleration(t: number): number {
        let dt = this.clampDt(t);
        const { t1, t2, a1, a3 } = this.trapezoidalParams();
        if (dt < t1) return a1;
        else if (dt < t1 + t2) return 0;
        else return a3;
    }

    // --- Cubic S-curve (position: 3x^2 - 2x^3) ---

    /**
     * Position for cubic S-curve segment.
     * @private
     * @param {number} t - The time.
     * @returns {number} The position at time t.
     */
    private sCurvePosition(t: number): number {
        let x = this.normalizedTime(t);
        let d = this.d;
        x = this.clamp01(x);
        return d * (3 * x * x - 2 * x * x * x);
    }

    /**
     * Velocity for cubic S-curve segment.
     * @private
     * @param {number} t - The time.
     * @returns {number} The velocity at time t.
     */
    private sCurveVelocity(t: number): number {
        let x = this.normalizedTime(t);
        let d = this.d;
        let T = this.t1 - this.t0;
        x = this.clamp01(x);
        return d * (6 * x - 6 * x * x) / T;
    }

    /**
     * Acceleration for cubic S-curve segment.
     * @private
     * @param {number} t - The time.
     * @returns {number} The acceleration at time t.
     */
    private sCurveAcceleration(t: number): number {
        let x = this.normalizedTime(t);
        let d = this.d;
        let T = this.t1 - this.t0;
        x = this.clamp01(x);
        return d * (6 - 12 * x) / (T * T);
    }

    /**
     * Jerk for cubic S-curve segment.
     * @private
     * @param {number} t - The time.
     * @returns {number} The jerk at time t.
     */
    private sCurveJerk(t: number): number {
        let d = this.d;
        let T = this.t1 - this.t0;
        return -12 * d / (T * T * T);
    }

    // --- Polynomial segment (arbitrary coefficients, highest flexibility) ---

    /**
     * Position for polynomial segment.
     * @private
     * @param {number} t - The time.
     * @returns {number} The position at time t.
     * @throws {Error} If coefficients are not provided.
     */
    private polynomialPosition(t: number): number {
        if (!this.coeffs) throw new Error('No coefficients provided');
        let dt = this.clampDt(t);
        return this.coeffs.reduce((sum, c, i) => sum + c * Math.pow(dt, i), 0);
    }

    /**
     * Velocity for polynomial segment.
     * @private
     * @param {number} t - The time.
     * @returns {number} The velocity at time t.
     * @throws {Error} If coefficients are not provided.
     */
    private polynomialVelocity(t: number): number {
        if (!this.coeffs) throw new Error('No coefficients provided');
        let dt = this.clampDt(t);
        return this.coeffs.slice(1).reduce((sum, c, i) => sum + c * (i + 1) * Math.pow(dt, i), 0);
    }

    /**
     * Acceleration for polynomial segment.
     * @private
     * @param {number} t - The time.
     * @returns {number} The acceleration at time t.
     * @throws {Error} If coefficients are not provided.
     */
    private polynomialAcceleration(t: number): number {
        if (!this.coeffs) throw new Error('No coefficients provided');
        let dt = this.clampDt(t);
        return this.coeffs.slice(2).reduce((sum, c, i) => sum + c * (i + 2) * (i + 1) * Math.pow(dt, i), 0);
    }

    /**
     * Jerk for polynomial segment.
     * @private
     * @param {number} t - The time.
     * @returns {number} The jerk at time t.
     * @throws {Error} If coefficients are not provided.
     */
    private polynomialJerk(t: number): number {
        if (!this.coeffs) throw new Error('No coefficients provided');
        let dt = this.clampDt(t);
        return this.coeffs.slice(3).reduce((sum, c, i) => sum + c * (i + 3) * (i + 2) * (i + 1) * Math.pow(dt, i), 0);
    }

    // --- Jerk-limited S-curve (arbitrary v/a/j at endpoints) ---

    /**
     * Calculate coefficients for jerk-limited S-curve segment.
     * @private
     * @returns {number[]} The coefficients for the 7th-order polynomial.
     */
    private calcJerkLimitedCoeffs(): number[] {
        // Fit s(t) = a0 + a1*t + a2*t^2 + ... + a7*t^7 to 8 boundary conditions
        const T = this.t1 - this.t0;
        const d = this.d;
        const v0 = this.v0, vf = this.vf;
        const a0 = this.a0, af = this.af;
        const j0 = this.j0, jf = this.jf;
        const M = [
            [1, 0, 0, 0, 0, 0, 0, 0], // s(0) = 0
            [0, 1, 0, 0, 0, 0, 0, 0], // s'(0) = v0
            [0, 0, 2, 0, 0, 0, 0, 0], // s''(0) = a0
            [0, 0, 0, 6, 0, 0, 0, 0], // s'''(0) = j0
            [1, T, T**2, T**3, T**4, T**5, T**6, T**7], // s(T) = d
            [0, 1, 2*T, 3*T**2, 4*T**3, 5*T**4, 6*T**5, 7*T**6], // s'(T) = vf
            [0, 0, 2, 6*T, 12*T**2, 20*T**3, 30*T**4, 42*T**5], // s''(T) = af
            [0, 0, 0, 6, 24*T, 60*T**2, 120*T**3, 210*T**4], // s'''(T) = jf
        ];
        const b = [
            0,
            v0,
            a0,
            j0,
            d,
            vf,
            af,
            jf
        ];
        return solveLinearSystem(M, b);
    }

    /**
     * Evaluate jerk-limited polynomial and its derivatives.
     * @private
     * @param {number} t - The time.
     * @param {number} deriv - The derivative order (0=pos, 1=vel, 2=acc, 3=jerk).
     * @returns {number} The value at time t.
     */
    private jerkLimitedPolyEval(t: number, deriv: number = 0): number {
        const coeffs = this.jerkCoeffs!;
        let dt = t - this.t0;
        if (dt < 0) dt = 0;
        if (dt > (this.t1 - this.t0)) dt = this.t1 - this.t0;
        if (deriv === 0)
            return coeffs.reduce((sum, c, i) => sum + c * Math.pow(dt, i), 0);
        if (deriv === 1)
            return coeffs.slice(1).reduce((sum, c, i) => sum + c * (i+1) * Math.pow(dt, i), 0);
        if (deriv === 2)
            return coeffs.slice(2).reduce((sum, c, i) => sum + c * (i+2) * (i+1) * Math.pow(dt, i), 0);
        if (deriv === 3)
            return coeffs.slice(3).reduce((sum, c, i) => sum + c * (i+3) * (i+2) * (i+1) * Math.pow(dt, i), 0);
        return 0;
    }

    /**
     * Position for jerk-limited segment.
     * @private
     * @param {number} t - The time.
     * @returns {number} The position at time t.
     * @throws {Error} If coefficients are not set.
     */
    private jerkLimitedPosition(t: number): number {
        if (!this.jerkCoeffs) throw new Error('Coefficients not set');
        return this.jerkLimitedPolyEval(t, 0);
    }

    /**
     * Velocity for jerk-limited segment.
     * @private
     * @param {number} t - The time.
     * @returns {number} The velocity at time t.
     * @throws {Error} If coefficients are not set.
     */
    private jerkLimitedVelocity(t: number): number {
        if (!this.jerkCoeffs) throw new Error('Coefficients not set');
        return this.jerkLimitedPolyEval(t, 1);
    }

    /**
     * Acceleration for jerk-limited segment.
     * @private
     * @param {number} t - The time.
     * @returns {number} The acceleration at time t.
     * @throws {Error} If coefficients are not set.
     */
    private jerkLimitedAcceleration(t: number): number {
        if (!this.jerkCoeffs) throw new Error('Coefficients not set');
        return this.jerkLimitedPolyEval(t, 2);
    }

    /**
     * Jerk for jerk-limited segment.
     * @private
     * @param {number} t - The time.
     * @returns {number} The jerk at time t.
     * @throws {Error} If coefficients are not set.
     */
    private jerkLimitedJerk(t: number): number {
        if (!this.jerkCoeffs) throw new Error('Coefficients not set');
        return this.jerkLimitedPolyEval(t, 3);
    }

    // --- Helpers ---

    /**
     * Clamp time to the segment interval and return delta time from t0.
     * @private
     * @param {number} t - The time.
     * @returns {number} The clamped delta time.
     */
    private clampDt(t: number): number {
        if (t < this.t0) return 0;
        if (t > this.t1) return this.t1 - this.t0;
        return t - this.t0;
    }

    /**
     * Normalize time to [0, 1] over the segment interval.
     * @private
     * @param {number} t - The time.
     * @returns {number} Normalized time in [0, 1].
     */
    private normalizedTime(t: number): number {
        return (t - this.t0) / (this.t1 - this.t0);
    }

    /**
     * Clamp a value to [0, 1].
     * @private
     * @param {number} x - The value.
     * @returns {number} The clamped value.
     */
    private clamp01(x: number): number {
        return Math.max(0, Math.min(1, x));
    }
}

/**
 * Solve a linear system Ax = b using Gaussian elimination.
 * @param {number[][]} M - The matrix A.
 * @param {number[]} b - The vector b.
 * @returns {number[]} The solution vector x.
 */
function solveLinearSystem(M: number[][], b: number[]): number[] {
    const n = b.length;
    const A = M.map((row, i) => [...row, b[i]]);
    for (let i = 0; i < n; i++) {
        // Pivot
        let maxRow = i;
        for (let k = i + 1; k < n; k++)
            if (Math.abs(A[k][i]) > Math.abs(A[maxRow][i])) maxRow = k;
        [A[i], A[maxRow]] = [A[maxRow], A[i]];
        // Normalize row
        let factor = A[i][i];
        for (let j = 0; j <= n; j++) A[i][j] /= factor;
        // Eliminate column
        for (let k = 0; k < n; k++) {
            if (k === i) continue;
            let coeff = A[k][i];
            for (let j = 0; j <= n; j++)
                A[k][j] -= coeff * A[i][j];
        }
    }
    return A.map(row => row[n]);
}

export default MotionSegment;
