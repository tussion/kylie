/*
 * Copyright (c) 2013, Salesforce.com. All rights reserved.
 * Copyrights licensed under the BSD License. See the accompanying LICENSE.txt file for terms.
 */

/*jshint sub:true*/

/**
 * @dict
 */
var perfOptions = window["perfOptions"];

if (perfOptions) {
    if (!perfOptions.pageStartTime) {
        perfOptions.pageStartTime = new Date().getTime();
    }
    if (perfOptions.bURL) {
        BOOMR.setBeaconUrl(perfOptions.bURL);
    }
} else {
    perfOptions = {
        pageStartTime: new Date().getTime()
    };
}

/**
 * @const
 * @private
 * @type {!string}
 */
var BEACONURL = "";

/**
 * @private
 * @type {?string}
 */
var _beaconData = null;

/**
 * Converts the logLevel param into a valid window.typePerfLogLevel.
 *
 * @param {string|window.typePerfLogLevel=} logLevel The level at which this mark should be logged at. Defaults
 *        to PerfLogLevel.INTERNAL if left blank
 * @return {!window.typePerfLogLevel}
 * @private
 */
function getLogLevel(logLevel) {
    if (typeof logLevel === "string") {
        logLevel = PerfLogLevel[logLevel];
    }
    return logLevel || PerfLogLevel.PRODUCTION;
}

/**
 * This method is used to the update the name of a timer
 *
 * @param {!string} oldName The id used to identify the old mark name.
 * @param {!string} newName The id used to identify the new mark name.
 * @return {!IPerf} for chaining methods
 * @private
 */
function updateTimerName(oldName, newName) {
    BOOMR.plugins.RT.updateTimer(oldName, newName);
    return Perf;
}

/**
 * This is the shim object to support the existing mark and measure functionality
 *
 * @namespace
 * @const
 * @type {!IPerf}
 */
var Perf = /** @type {!IPerf} */({
    /**
     * @type {!window.typePerfLogLevel}
     * @private
     */
    currentLogLevel: getLogLevel(perfOptions.logLevel),

    /**
     * @type {!number}
     * @const
     * @expose
     */
    startTime: perfOptions.pageStartTime,

    /**
     * @param {!string} id The id used to identify the mark.
     * @param {string|window.typePerfLogLevel=} logLevel The level at which this mark should be logged at. Defaults
     *        to PerfLogLevel.INTERNAL if left blank
     * @return {!IPerf}
     * @expose
     */
    mark: function (id, logLevel) {
        // don't log things that are less important than the current logging
        // level
        if (Perf.currentLogLevel.value <= getLogLevel(logLevel).value) {
            BOOMR.plugins.RT.startTimer(id);
        }
        return Perf;
    },

    /**
     * @param {!string} id This is the id associated with the mark that uses the same id.
     * @param {string|window.typePerfLogLevel=} logLevel The level at which this mark should be logged at. Defaults
     *        to PerfLogLevel.INTERNAL if left blank
     * @return {!IPerf}
     * @expose
     */
    endMark: function (id, logLevel) {
        // don't log things that are less important than the current logging
        // level
        if (Perf.currentLogLevel.value <= getLogLevel(logLevel).value) {
            BOOMR.plugins.RT.endTimer(id);
        }
        return Perf;
    },

    /**
     * This method is used to the update the name of a mark
     *
     * @param {!string} oldName The id used to identify the old mark name.
     * @param {!string} newName The id used to identify the new mark name.
     * @return {!IPerf} for chaining methods
     * @expose
     */
    updateMarkName: updateTimerName,

    /**
     * @param {!string} timer_name The name of the timer to set.
     * @param {number=} timer_delta The time delta to set.
     * @param {string|window.typePerfLogLevel=} logLevel The level at which this mark should be logged at. Defaults
     *        to PerfLogLevel.INTERNAL if left blank
     * @return {!IPerf}
     * @expose
     */
    setTimer: function (timer_name, timer_delta, logLevel) {
        if (Perf.currentLogLevel.value <= getLogLevel(logLevel).value) {
            if (timer_delta >= 0) {
                BOOMR.plugins.RT.setTimer(timer_name, timer_delta);
            } else {
                BOOMR.plugins.RT.endTimer(timer_name);
            }
        }
        return Perf;
    },
    /**
     * Serializes a measure object to JSON.
     *
     * @param {!window.typejsonMeasure} measure The measure to serialize.
     * @return {!string} JSON-serialized version of the supplied measure.
     * @expose
     */
    measureToJson: function (measure) {
        return "{" + PerfConstants.MEASURE_NAME + ':"' + measure[PerfConstants.MEASURE_NAME] + '",' + PerfConstants.MARK_NAME + ':"' + measure[PerfConstants.MARK_NAME] + '",' + PerfConstants.ELAPSED_TIME + ":" + measure[PerfConstants.ELAPSED_TIME] +
                "," + PerfConstants.REFERENCE_TIME + ":" + measure[PerfConstants.REFERENCE_TIME] + "}";
    },

    /**
     * Serializes timers to JSON.
     *
     * @param {boolean=} includeMarks
     * @return {!string} JSON-serialized version of timers.
     * @expose
     * @suppress {checkTypes}
     */
    toJson: function (includeMarks) {
        // check and update any newly created timers
        BOOMR.plugins.RT.updateVars();
        // this is a hack to include RT in the beacon - sorry this is the quickest fix I could come up with.
        var timers = BOOMR.plugins.RT.getTimers(),
            rt = BOOMR.plugins.RT.getSessionStart(),
            json = ["{", 'sessionID:"', BOOMR.plugins.RT.getSessionID(), '",', "st:", rt, ",", 'pn:"', window.document.URL, '",', 'uid:"', Math.round(Math.random() * 1000000000000000), '",'],
            markJson = [],
            measureJson = [],
            k,
            measure,
            vars = BOOMR.getVars(),
            timer;

        for (k in vars) {
            if ((k != "r") && (k != "r2") && (k != "t_other")) {
                if (vars.hasOwnProperty(k) && !isNaN(vars[k])) {
                    if (includeMarks) {
                        markJson.push('"' + k + '":' + vars[k]);
                    }
                    measure = {};
                    measure[PerfConstants.MEASURE_NAME] = k;
                    measure[PerfConstants.MARK_NAME] = k;
                    measure[PerfConstants.ELAPSED_TIME] = vars[k];
                    timer = timers[k];
                    measure[PerfConstants.REFERENCE_TIME] = (timer && timer.start) ? timer.start : rt;
                    measureJson.push(Perf.measureToJson(measure));
                }
            }
        }
        if (includeMarks) {
            json.push("marks:{", markJson.join(","), "},");
        }
        json.push("measures:[", measureJson.join(","), "]}");

        return json.join("");
    },

    /**
     * Get a JSON-serialized version of all existing timers and stats in POST friendly format.
     *
     * @return {!string} POST-friendly timers and stats.
     * @expose
     */
    toPostVar: function () {
        return PerfConstants.PERF_PAYLOAD_PARAM + "=" + Perf.toJson().replace(/&/g, "__^__");
    },

    /**
     * Returns all of the measures that have been captured
     *
     * @return {!Array.<window.typejsonMeasure>} all existing measures.
     * @expose
     */
    getMeasures: function () {
        // check and update any newly created timers
        BOOMR.plugins.RT.updateVars();
        var timers = BOOMR.plugins.RT.getTimers(),
            rt = BOOMR.plugins.RT.getSessionStart(),
            measures = [],
            vars = BOOMR.getVars(),
            k,
            measure;
        for (k in vars) {
            if ((k != "r") && (k != "r2") && (k != "t_other")) {
                if (vars.hasOwnProperty(k) && !isNaN(vars[k])) {
                    measure = {};
                    measure[PerfConstants.MEASURE_NAME] = k;
                    measure[PerfConstants.MARK_NAME] = k;
                    measure[PerfConstants.ELAPSED_TIME] = vars[k];
                    measure[PerfConstants.REFERENCE_TIME] = timers[k] ? timers[k].start : rt;
                    measures.push(measure);
                }
            }
        }

        return measures;
    },

    /**
     * Returns the beaconData to piggyback on the next XHR call
     *
     * @return {?string} beacon data.
     * @expose
     */
    getBeaconData: function () {
        return _beaconData;
    },

    /**
     * Sets the beaconData to piggyback on the next XHR call
     *
     * @param {!string} beaconData
     * @expose
     */
    setBeaconData: function (beaconData) {
        _beaconData = beaconData;
    },

    /**
     * Clears beacon data
     *
     * @expose
     */
    clearBeaconData: function () {
        _beaconData = null;
    },

    /**
     * Removes the existing timers
     *
     * @expose
     */
    removeStats: function () {
        BOOMR.removeStats();
    },

    /**
     * @typedef {BOOMR.subscribe}
     */
    subscribe: BOOMR.subscribe,

    /**
     * Add a performance measurement from the server.
     *
     * @param {!string} label
     * @param {!number} elapsedMillis
     * @return {!IPerf}
     * @expose
     */
    stat: function (label, elapsedMillis) {
        BOOMR.addVar("st_" + label, elapsedMillis);
        return Perf;
    },

    /**
     * Get the stored server side performance measures.
     *
     * @param {!string} label
     * @return {!string|number}
     * @expose
     */
    getStat: function (label) {
        // check and update any newly created timers
        BOOMR.plugins.RT.updateVars();
        if (!label) {
            return -1;
        }
        return BOOMR.getVar(label);
    },

    /**
     * Called when the page is ready to interact with. To support the existing Kylie.onLoad method.
     *
     * @expose
     */
    onLoad: function () {
        BOOMR.page_ready();
    },

    /**
     * @param {?string} measureName Not used.
     * @param {!string} id This is the id associated with the mark that uses the same id.
     * @param {window.typePerfLogLevel=} logLevel The level at which this mark should be logged at.
     * @return {!IPerf}
     * @deprecated Use endMark instead
     * @expose
     */
    measure: function (measureName, id, logLevel) {
        return Perf.endMark(id, logLevel);
    },

    /**
     * This method is used to mark the start of a transaction
     *
     * @return {!IPerf} for chaining methods
     * @expose
     */
    startTransaction: function (tName) {
        BOOMR.plugins.RT.startTransaction(tName);
        return Perf;
    },

    /**
     * This method is used to mark the start of a transaction
     *
     * @return {!IPerf} for chaining methods
     * @expose
     */
    endTransaction: function (tName) {
        BOOMR.plugins.RT.endTransaction(tName);
        return Perf;
    },

    /**
     * This method is used to the update the name of the
     * transaction
     *
     * @param {!string} oldName The id used to identify the old transaction name.
     * @param {!string} newName The id used to identify the new transaction name.
     * @return {!IPerf} for chaining methods
     * @expose
     */
    updateTransaction: updateTimerName,

    /**
     * This method is used to figure if onLoad/page_ready has been fired or 
     * not
     *
     * @return {!boolean}
     * @expose
     */
    onLoadFired: function () {
        return BOOMR.plugins.RT.onLoadFired();
    },

    /**
     * @namespace
     * @type {{setCookie: function (string, (number|string), Date, string)}}
     * @expose
     */
    util: {
        /**
         * Sets the roundtrip time cookie
         *
         * @param {!string} name
         * @param {!string|number} value
         * @param {Date} expires
         * @param {string} path
         * @expose
         */
        setCookie: function (name, value, expires, path) {
            document.cookie = name + "=" + escape(value + "") + ((expires) ? "; expires=" + expires.toGMTString() : "") + ((path) ? "; path=" + path : "; path=/");
        }
    },

    /**
     * @type {boolean}
     * @const
     * @expose
     */
    loaded: true,

    /**
     * Whether the full Kylie framework is loaded, as opposed to just the stubs.
     *
     * @type {boolean}
     * @const
     * @expose
     */
    enabled: true
});

/**
 * @define {!string}
 * @private
 */
var ROOT_NAMESPACE = "Kylie";

window["Perf"] = Perf;
window[ROOT_NAMESPACE] = Perf;
window["PerfLogLevel"] = PerfLogLevel;
window["PerfConstants"] = PerfConstants;