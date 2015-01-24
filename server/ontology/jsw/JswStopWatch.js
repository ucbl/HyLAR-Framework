/**
 * Created by Spadon on 17/10/2014.
 */

/** Stopwatch allows measuring time between different events. */
var Stopwatch = function () {

    var startTime, // Time (in milliseconds) when the stopwatch was started last time.
        elapsedMs = null; // Contains the number of milliseconds in the last measured period of time.

    /**
     * Returns textual representation of the last measured period of time.
     *
     * @return string representation of the last measured period of time.
     */
    this.getElapsedTimeAsText = function () {
        var milliseconds = elapsedMs % 1000,
            hours = Math.floor(elapsedMs / 3600000),
            minutes = Math.floor(elapsedMs % 3600000 / 60000),
            seconds = Math.floor(elapsedMs % 60000 / 1000);

        if (milliseconds < 10) {
            milliseconds = '00' + milliseconds.toString();
        } else if (milliseconds < 100) {
            milliseconds = '0' + milliseconds.toString();
        }

        return hours + ' : ' + minutes + ' : ' + seconds + '.' + milliseconds;
    };

    /**
     * Starts measuring the time.
     */
    this.start = function () {
        startTime = new Date().getTime();
        elapsedMs = null;
    };

    /**
     * Stops measuring the time.
     *
     * @return string representation of the measured period of time.
     */
    this.stop = function () {
        elapsedMs = new Date().getTime() - startTime;
        return this.getElapsedTimeAsText();
    };
};

module.exports = {
    stopWatch: function() {
        return new Stopwatch();
    }
};

