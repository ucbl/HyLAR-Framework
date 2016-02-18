/**
 * Created by Spadon on 05/03/2015.
 */

app.service('Hylar', ['HylarClient', 'HylarRemote',
    function(HylarClient, HylarRemote) {
        this.config = {
            classification: 'server',
            querying: 'client',
            inWorker: true,
            reasoningMethod: 'greedy',
            reasoner: localStorage.getItem('reasoner'),
            query:  'PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> ' +
                    'PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#> ' +
                    'SELECT ?a ?b { ?a rdfs:subClassOf ?b }'
        };

        this.exampleReq = {
            insert10:'PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> ' +
                'INSERT DATA { ' +
                'GRAPH <http://liris.cnrs.fr/asawoo/devices/10/> { ' +
                '<#a> rdf:type <#Device> . ' +
                '<#b> rdf:type <#Device> . ' +
                '<#a> <#hasConnection> <#Wifi> . ' +
                '<#b> <#hasConnection> <#Ethernet100mbps>' +
                '<#a> <#hasName> "a" . ' +
                '<#b> <#hasName> "b" . ' +
                '<#c> <#hasName> "c" . ' +
                '<#d> <#hasName> "d" . ' +
                '<#e> <#hasName> "e" . ' +
                '<#f> <#hasName> "f" . ' +
                '} }',
            insert20:'PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> ' +
                'INSERT DATA { ' +
                'GRAPH <http://liris.cnrs.fr/asawoo/devices/20/> { ' +
                '<#a> rdf:type <#Device> . ' +
                '<#b> rdf:type <#Device> . ' +
                '<#c> rdf:type <#Device> . ' +
                '<#d> rdf:type <#Device> . ' +
                '<#e> rdf:type <#Device> . ' +
                '<#f> rdf:type <#Device> . ' +
                '<#g> rdf:type <#Device> . ' +
                '<#h> rdf:type <#Device> . ' +
                '<#a> <#hasConnection> <#Wifi> . ' +
                '<#b> <#hasConnection> <#Ethernet100mbps>' +
                '<#a> <#hasName> "a" . ' +
                '<#b> <#hasName> "b" . ' +
                '<#c> <#hasName> "c" . ' +
                '<#d> <#hasName> "d" . ' +
                '<#e> <#hasName> "e" . ' +
                '<#f> <#hasName> "f" . ' +
                '<#Wifi> rdf:type <#ConnectionDescription> . ' +
                '<#Bluetooth> rdf:type <#ConnectionDescription> . ' +
                '<#Zigbee> rdf:type <#ConnectionDescription> . ' +
                '<#Ethernet100mbps> rdf:type <#ConnectionDescription> . ' +
                '} }',
            insert30:'PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> ' +
                'INSERT DATA { ' +
                'GRAPH <http://liris.cnrs.fr/asawoo/devices/30/> { ' +
                '<#a> rdf:type <#Device> . ' +
                '<#b> rdf:type <#Device> . ' +
                '<#c> rdf:type <#Device> . ' +
                '<#d> rdf:type <#Device> . ' +
                '<#e> rdf:type <#Device> . ' +
                '<#f> rdf:type <#Device> . ' +
                '<#g> rdf:type <#Device> . ' +
                '<#h> rdf:type <#Device> . ' +
                '<#a> <#hasConnection> <#Wifi> . ' +
                '<#b> <#hasConnection> <#Ethernet100mbps> . ' +
                '<#c> <#hasConnection> <#Bluetooth> . ' +
                '<#r1> rdf:type <#RequestDeviceInfo> . ' +
                '<#r2> rdf:type <#RequestDeviceInfo> . ' +
                '<#r3> rdf:type <#RequestDeviceInfo> . ' +
                '<#r4> rdf:type <#RequestDeviceInfo> . ' +
                '<#r5> rdf:type <#RequestDeviceInfo> . ' +
                '<#r6> rdf:type <#RequestDeviceInfo> . ' +
                '<#r7> rdf:type <#RequestDeviceInfo> . ' +
                '<#r8> rdf:type <#RequestDeviceInfo> . ' +
                '<#r9> rdf:type <#RequestDeviceInfo> . ' +
                '<#a> <#hasName> "a" . ' +
                '<#b> <#hasName> "b" . ' +
                '<#c> <#hasName> "c" . ' +
                '<#d> <#hasName> "d" . ' +
                '<#e> <#hasName> "e" . ' +
                '<#f> <#hasName> "f" . ' +
                '<#Wifi> rdf:type <#ConnectionDescription> . ' +
                '<#Bluetooth> rdf:type <#ConnectionDescription> . ' +
                '<#Zigbee> rdf:type <#ConnectionDescription> . ' +
                '<#Ethernet100mbps> rdf:type <#ConnectionDescription> . ' +
                '} }',
            insert40:'PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> ' +
                'INSERT DATA { ' +
                'GRAPH <http://liris.cnrs.fr/asawoo/devices/40/> { ' +
                '<#a> rdf:type <#Device> . ' +
                '<#b> rdf:type <#Device> . ' +
                '<#c> rdf:type <#Device> . ' +
                '<#d> rdf:type <#Device> . ' +
                '<#e> rdf:type <#Device> . ' +
                '<#f> rdf:type <#Device> . ' +
                '<#g> rdf:type <#Device> . ' +
                '<#h> rdf:type <#Device> . ' +
                '<#a> <#hasConnection> <#Wifi> . ' +
                '<#b> <#hasConnection> <#Ethernet100mbps> . ' +
                '<#i> rdf:type <#Device> . ' +
                '<#j> rdf:type <#Device> . ' +
                '<#k> rdf:type <#Device> . ' +
                '<#l> rdf:type <#Device> . ' +
                '<#m> rdf:type <#Device> . ' +
                '<#n> rdf:type <#Device> . ' +
                '<#o> rdf:type <#Device> . ' +
                '<#p> rdf:type <#Device> . ' +
                '<#o> <#hasConnection> <#Wifi> . ' +
                '<#p> <#hasConnection> <#Ethernet100mbps> . ' +
                '<#c> <#hasConnection> <#Bluetooth> . ' +
                '<#r1> rdf:type <#RequestDeviceInfo> . ' +
                '<#r2> rdf:type <#RequestDeviceInfo> . ' +
                '<#r3> rdf:type <#RequestDeviceInfo> . ' +
                '<#r4> rdf:type <#RequestDeviceInfo> . ' +
                '<#r5> rdf:type <#RequestDeviceInfo> . ' +
                '<#r6> rdf:type <#RequestDeviceInfo> . ' +
                '<#r7> rdf:type <#RequestDeviceInfo> . ' +
                '<#r8> rdf:type <#RequestDeviceInfo> . ' +
                '<#r9> rdf:type <#RequestDeviceInfo> . ' +
                '<#a> <#hasName> "a" . ' +
                '<#b> <#hasName> "b" . ' +
                '<#c> <#hasName> "c" . ' +
                '<#d> <#hasName> "d" . ' +
                '<#e> <#hasName> "e" . ' +
                '<#f> <#hasName> "f" . ' +
                '<#Wifi> rdf:type <#ConnectionDescription> . ' +
                '<#Bluetooth> rdf:type <#ConnectionDescription> . ' +
                '<#Zigbee> rdf:type <#ConnectionDescription> . ' +
                '<#Ethernet100mbps> rdf:type <#ConnectionDescription> . ' +
                '} }',
            insert50:'PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> ' +
                'INSERT DATA { ' +
                'GRAPH <http://liris.cnrs.fr/asawoo/devices/50/> { ' +
                '<#a> rdf:type <#Device> . ' +
                '<#b> rdf:type <#Device> . ' +
                '<#c> rdf:type <#Device> . ' +
                '<#d> rdf:type <#Device> . ' +
                '<#e> rdf:type <#Device> . ' +
                '<#f> rdf:type <#Device> . ' +
                '<#g> rdf:type <#Device> . ' +
                '<#h> rdf:type <#Device> . ' +
                '<#a> <#hasConnection> <#Wifi> . ' +
                '<#b> <#hasConnection> <#Ethernet100mbps> . ' +
                '<#i> rdf:type <#Device> . ' +
                '<#j> rdf:type <#Device> . ' +
                '<#k> rdf:type <#Device> . ' +
                '<#l> rdf:type <#Device> . ' +
                '<#m> rdf:type <#Device> . ' +
                '<#n> rdf:type <#Device> . ' +
                '<#o> rdf:type <#Device> . ' +
                '<#p> rdf:type <#Device> . ' +
                '<#o> <#hasConnection> <#Wifi> . ' +
                '<#p> <#hasConnection> <#Ethernet100mbps> . ' +
                '<#aa> rdf:type <#Device> . ' +
                '<#bb> rdf:type <#Device> . ' +
                '<#cc> rdf:type <#Device> . ' +
                '<#dd> rdf:type <#Device> . ' +
                '<#ee> rdf:type <#Device> . ' +
                '<#ff> rdf:type <#Device> . ' +
                '<#gg> rdf:type <#Device> . ' +
                '<#hh> rdf:type <#Device> . ' +
                '<#hh> <#hasConnection> <#Wifi> . ' +
                '<#gg> <#hasConnection> <#Ethernet100mbps> . ' +
                '<#c> <#hasConnection> <#Bluetooth> . ' +
                '<#r1> rdf:type <#RequestDeviceInfo> . ' +
                '<#r2> rdf:type <#RequestDeviceInfo> . ' +
                '<#r3> rdf:type <#RequestDeviceInfo> . ' +
                '<#r4> rdf:type <#RequestDeviceInfo> . ' +
                '<#r5> rdf:type <#RequestDeviceInfo> . ' +
                '<#r6> rdf:type <#RequestDeviceInfo> . ' +
                '<#r7> rdf:type <#RequestDeviceInfo> . ' +
                '<#r8> rdf:type <#RequestDeviceInfo> . ' +
                '<#r9> rdf:type <#RequestDeviceInfo> . ' +
                '<#a> <#hasName> "a" . ' +
                '<#b> <#hasName> "b" . ' +
                '<#c> <#hasName> "c" . ' +
                '<#d> <#hasName> "d" . ' +
                '<#e> <#hasName> "e" . ' +
                '<#f> <#hasName> "f" . ' +
                '<#Wifi> rdf:type <#ConnectionDescription> . ' +
                '<#Bluetooth> rdf:type <#ConnectionDescription> . ' +
                '<#Zigbee> rdf:type <#ConnectionDescription> . ' +
                '<#Ethernet100mbps> rdf:type <#ConnectionDescription> . ' +
                '} }',
            insert3_1:'PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> ' +
                'INSERT DATA { ' +
                'GRAPH <http://liris.cnrs.fr/asawoo/devices/> { ' +
                '<#NokiaLumia> rdf:type <#Device> . ' +
                '<#NokiaLumia> <#hasConnection> <#Bluetooth> . ' +
                '<#NokiaLumia> <#hasName> "Nokia Lumia 635" . ' +
                '} ' +
                'GRAPH <http://liris.cnrs.fr/asawoo/other/> { ' +
                '<#Request23> rdf:type <#RequestDeviceInfo> ' +
                '} ' +
                '}',
            select_all:'PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> ' +
                'SELECT ?a { ?a rdf:type <#Device> }',
            select10:'PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> ' +
                'SELECT ?a FROM NAMED <http://liris.cnrs.fr/asawoo/devices/10/> { ?a rdf:type <#Device> }',
            select20:'PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> ' +
                'SELECT ?a FROM NAMED <http://liris.cnrs.fr/asawoo/devices/20/> { ?a rdf:type <#Device> }',
            select30:'PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> ' +
                'SELECT ?a FROM NAMED <http://liris.cnrs.fr/asawoo/devices/30/> { ?a rdf:type <#Device> }',
            select40:'PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> ' +
                'SELECT ?a FROM NAMED <http://liris.cnrs.fr/asawoo/devices/40/> { ?a rdf:type <#Device> }',
            select50:'PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> ' +
                'SELECT ?a FROM NAMED <http://liris.cnrs.fr/asawoo/devices/50/> { ?a rdf:type <#Device> }',
            select3:'PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> ' +
                'SELECT ?a FROM NAMED <http://liris.cnrs.fr/asawoo/devices/> { ?a rdf:type <#Device> }',
            select4:'PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> ' +
                'SELECT ?a FROM NAMED <http://liris.cnrs.fr/asawoo/other/> { ?a rdf:type <#RequestDeviceInfo> }',
            delete1:'',
            delete2:''
        };

        this.client = HylarClient;
        this.remote = HylarRemote;
    }
]);