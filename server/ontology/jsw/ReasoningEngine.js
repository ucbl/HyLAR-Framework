/**
 * Created by Spadon on 11/09/2015.
 */

var Logics = require('./Logics');

module.exports = {
    /**
     * A naïve reasoner that recalculates the entire knowledge base
     * wtr. a set of triples to insert and a set of triples to delete.
     * @param triplesIns
     * @param triplesDel
     * @param rules
     * @returns {{fi: *, fe: *}}
     */
    naive: function(FeAdd, FeDel, F, R) {
        // Total facts
        F = Logics.core.mergeFactSets(F, FeAdd);

        var consequencesToDel = FeDel;
        for (var key in consequencesToDel) {
            var factToDel = consequencesToDel[key],
                factToDelConsequences;
            factToDel.__proto__ = Logics.fact().__proto__;
            factToDelConsequences = factToDel.getConsequencesIn(F);
            consequencesToDel = Logics.core.mergeFactSets(consequencesToDel, factToDelConsequences);
        }
        F = Logics.core.substractFactSets(F, consequencesToDel);

        var consequencesToAdd = [];
        for (var key in R) {
            var subsequentConsequences = R[key].consequences(Logics.core.mergeFactSets(consequencesToAdd, F));
            consequencesToAdd = Logics.core.mergeFactSets(consequencesToAdd, subsequentConsequences);
        }

        var allFacts = Logics.core.mergeFactSets(consequencesToAdd, F);

        return {
            fi: Logics.core.getOnlyImplicitFacts(allFacts),
            fe: Logics.core.getOnlyExplicitFacts(allFacts)
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
        var Rdel = [],
            Rred = [],
            Rins = [],
            FiDel = [],
            FiAdd = [];

        // Deletion
        if (FeDel && FeDel.length) {
            Rdel = R.restrictTo(Logics.core.mergeFactSets(FeDel, FiDel));
            FiDel = Rdel.evaluate(Logics.core.mergeFactSets(F, FeDel));
            F = Logics.core.substractFactSets(F, Logics.core.mergeFactSets(FeDel, FiDel));

            Rred = R.restrictTo(R, Logics.core.mergeFactSets(FiDel));
            FiAdd = Rred.evaluate(Logics.core.mergeFactSets(F, FiDel));
        }

        // Insertion
        if (FeAdd && FeAdd.length) {
            Rins = this.restrictTo(R, Logics.core.mergeFactSets(F, FeAdd, FiAdd));
            FiAdd = Logics.core.mergeFactSets(FiAdd, this.evaluate(Rins, Logics.core.mergeFactSets(F, FeAdd, FiAdd)));
            F = Logics.core.mergeFactSets(F, Logics.core.mergeFactSets(FeAdd, FiAdd));
        }

        return {
            fi: Logics.core.getOnlyImplicitFacts(F),
            fe: Logics.core.getOnlyExplicitFacts(F)
        };
    }
};