/**
 * Created by Spadon on 11/09/2015.
 */

var Logics = require('./Logics');

ReasoningEngine = {
    /**
     * A naive reasoner that recalculates the entire knowledge base
     * @param triplesIns
     * @param triplesDel
     * @param rules
     * @returns {{fi: *, fe: *}}
     */
    naive: function(FeAdd, FeDel, F, R) {
        var restrictedF;
        // Total facts
        F = Logics.core.mergeFactSets(F, FeAdd);

        // Restriction on graphs from both deletion/addition
        restrictedF = Logics.core.restrictToGraphsFrom(F, Logics.core.mergeFactSets(FeDel, FeAdd));

        // Deletion
        var consequencesToDel = Logics.core.evaluateRuleSet(R, restrictedF, FeDel);
        F = Logics.core.substractFactSets(F, consequencesToDel);

        // Insertion
        var consequencesToAdd = Logics.core.evaluateRuleSet(R, restrictedF, FeAdd);
        F = Logics.core.mergeFactSets(consequencesToAdd, F);

        return {
            fi: Logics.core.getOnlyImplicitFacts(F),
            fe: Logics.core.getOnlyExplicitFacts(F)
        };
    },

    /**
     * Incremental reasoning which avoids complete recalculation of facts
     * @param R set of rules
     * @param F set of assertions
     * @param FeAdd set of assertions to be added
     * @param FeDel set of assertions to be deleted
     */
    incremental: function (FeAdd, FeDel, F, R) {
        var restrictedF,
            Rdel = [],
            Rred = [],
            Rins = [],
            FiDel = [],
            FiAdd = [];

        // Total facts
        F = Logics.core.mergeFactSets(F, FeAdd);
        restrictedF = Logics.core.restrictToGraphsFrom(F, Logics.core.mergeFactSets(FeDel, FeAdd));

        // Deletion
        if (FeDel && FeDel.length) {
            Rdel = Logics.core.restrictRuleSet(R, Logics.core.mergeFactSets(FeDel, FiDel));
            FiDel = Logics.core.evaluateRuleSet(Rdel, restrictedF, FeDel);
            F = Logics.core.substractFactSets(F, Logics.core.mergeFactSets(FeDel, FiDel));

            Rred = Logics.core.restrictRuleSet(R, FiDel);
            FiAdd = Logics.core.evaluateRuleSet(Rred, restrictedF, FiDel);
        }

        // Insertion
        if (FeAdd && FeAdd.length) {
            Rins = Logics.core.restrictRuleSet(R, Logics.core.mergeFactSets(Logics.core.mergeFactSets(F, FeAdd), FiAdd));
            FiAdd = Logics.core.mergeFactSets(FiAdd, Logics.core.evaluateRuleSet(Rins, restrictedF, Logics.core.mergeFactSets(FeAdd, FiAdd)));
            F = Logics.core.mergeFactSets(F, Logics.core.mergeFactSets(FeAdd, FiAdd));
        }

        return {
            fi: Logics.core.getOnlyImplicitFacts(F),
            fe: Logics.core.getOnlyExplicitFacts(F)
        };
    }
};

module.exports = {
    naive: ReasoningEngine.naive,
    incremental: ReasoningEngine.incremental
};