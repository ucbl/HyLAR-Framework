/**
 * Created by Spadon on 05/03/2015.
 */

app.service('Hylar', ['HylarClient', 'HylarRemote',
    function(HylarClient, HylarRemote) {
        this.config = {
            classification: 'server',
            querying: 'client',
            inWorker: true,
            reasoner: localStorage.getItem('reasoner')
        };

        this.client = HylarClient;
        this.remote = HylarRemote;
    }
]);