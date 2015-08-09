import Promise from 'promise';
import SauceTunnel from 'sauce-tunnel';
import SauceLabsAdapter from './saucelabs-adapter';

export function openTunnel (settings) {
    return new Promise(function (resolve, reject) {
        var tunnelId = Math.floor((new Date()).getTime() / 1000 - 1230768000).toString();
        var tunnel   = new SauceTunnel(settings.username, settings.accessKey, tunnelId, true);

        tunnel.start(function (isCreated) {
            if (!isCreated)
                reject('Failed to create Sauce tunnel');
            else {
                settings.tunnelIdentifier = tunnelId;
                resolve(tunnel);
            }
        });
    });
}

export function closeTunnel (tunnel) {
    return new Promise(function (resolve, reject) {
        if (!tunnel)
            reject();
        else tunnel.stop(resolve);
    });
}

export async function run (settings) {
    var adapter = new SauceLabsAdapter(settings);

    return await adapter.runTests();
}
