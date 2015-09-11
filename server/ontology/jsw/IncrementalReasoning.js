/**
 * Created by Spadon on 11/09/2015.
 */

var Axiom = require('./Axiom');
var Rule = require('./Rule');

module.exports = {
    /**
     * Runs the incremental reasoning
     * @param R set of rules
     * @param F set of assertions
     * @param FeAdd set of assertions to be added
     * @param FeDel set of assertions to be deleted
     */
    run: function (R, F, FeAdd, FeDel) {
        var Rdel = [],
            Rred = [],
            Rins = [],
            FiDel = [],
            FiAdd = [];

        // Deletion
        if (FeDel && FeDel.length) {
            Rdel = this.restrict(R, [FeDel, FiDel]);
            FiDel = this.evaluate(Rdel, [F, FeDel]);
            F = this.removeFacts(F, [FeDel, FiDel]);

            Rred = this.restrict(R, [FiDel]);
            FiAdd = this.evaluate(Rred, [F, FiDel]);
        }

        // Insertion
        if (FeAdd && FeAdd.length) {
            Rins = this.restrict(R, [F, FeAdd, FiAdd]);
            FiAdd = this.addFacts(FiAdd, this.evaluate(Rins, [F, FeAdd, FiAdd]));
            F = this.addFacts(F, [FeAdd, FiAdd]);
        }

        return F;
    },

    /**
     * Returns R restricted to FSet
     * @param R set of rules
     * @param FSet set of assertions
     */
    restrict: function (R, FSet) {
        return;
    },

    /**
     * Evaluates R over FSet
     * @param R set of rules
     * @param FSet set of assertions
     */
    evaluate: function (R, FSet) {
        return;
    },

    /**
     * Removes FSet from F
     * @param F original set of assertions
     * @param FSet set of assertions to be deleted
     */
    removeFacts: function(F, FSet) {
        return;
    },

    /**
     * Adds FSet to F
     * @param F original set of assertions
     * @param FSet set of assertions to be added
     */
    addFacts: function(F, FSet) {
        return;
    }
};