/**
 * Created by Spadon on 14/10/2014.
 */

/** Defines types of expressions the objects in OWL namespace can work with.*/
module.exports = {

    ExpressionTypes: {
        /** SubClassOf axiom. */
        AXIOM_CLASS_SUB: 0,
        /** EquivalentClasses axiom. */
        AXIOM_CLASS_EQ: 1,
        /** DisjointClasses axiom */
        AXIOM_CLASS_DISJOINT: 2,
        /** SubObjectPropertyOf axiom. */
        AXIOM_OPROP_SUB: 3,
        /** EquivalentObjectProperties axiom. */
        AXIOM_OPROP_EQ: 4,
        /** ReflexiveObjectProperty axiom */
        AXIOM_OPROP_REFL: 5,
        /** TransitiveObjectProperty axiom */
        AXIOM_OPROP_TRAN: 6,
        /** ObjectIntersectionOf class expression. */
        CE_INTERSECT: 7,
        /** ObjectSomeValuesFrom class expression. */
        CE_OBJ_VALUES_FROM: 8,
        /** Class entity. */
        ET_CLASS: 9,
        /** ObjectProperty entity. */
        ET_OPROP: 10,
        /** (Named)Individual entity. */
        ET_INDIVIDUAL: 11,
        /** ClassAssertion fact. */
        FACT_CLASS: 12,
        /** ObjectPropertyAssertion fact. */
        FACT_OPROP: 13,
        /** SameIndividual fact */
        FACT_SAME_INDIVIDUAL: 14,
        /** DifferentIndividuals fact */
        FACT_DIFFERENT_INDIVIDUALS: 15,
        /** ObjectPropertyChain object property expression. */
        OPE_CHAIN: 16
    },

    IRIs: {
        /** Top concept. */
        THING: 'http://www.w3.org/2002/07/owl#Thing',
        /** Bottom concept. */
        NOTHING: 'http://www.w3.org/2002/07/owl#Nothing',
        /** Top object property. */
        TOP_OBJECT_PROPERTY: 'http://www.w3.org/2002/07/owl#topObjectProperty',
        /** Bottom object property. */
        BOTTOM_OBJECT_PROPERTY: 'http://www.w3.org/2002/07/owl#bottomObjectProperty',
    }
};