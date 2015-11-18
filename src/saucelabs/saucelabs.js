import Promise from 'pinkie';
import SauceTunnel from 'sauce-tunnel';
import SauceLabsRunner from './runner';
import wait from '../utils/wait';


const CREATE_TUNNEL_TIMEOUT           = 30 * 1000;
const MAX_CREATE_TUNNEL_ATTEMPT_COUNT = 20;


export async function openTunnel (settings) {
    function open () {
        return new Promise(function (resolve, reject) {
            var tunnelId = Math.floor((new Date()).getTime() / 1000 - 1230768000).toString();
            var tunnel   = new SauceTunnel(settings.username, settings.accessKey, tunnelId, true);

            tunnel.start(function (isCreated) {
                if (!isCreated)
                    resolve(null);
                else {
                    settings.tunnelIdentifier = tunnelId;
                    resolve(tunnel);
                }
            });
        });
    }

    var tunnel  = null;
    var counter = 0;

    while (!tunnel && counter++ < MAX_CREATE_TUNNEL_ATTEMPT_COUNT) {
        tunnel = await open();

        if (!tunnel) {
            await wait(CREATE_TUNNEL_TIMEOUT);
            console.log(`Failed to create Sauce tunnel (attempt ${counter} from ${MAX_CREATE_TUNNEL_ATTEMPT_COUNT})`);
        }
        else console.log('Sauce tunnel created');
    }


    if (!tunnel)
        throw 'Failed to create Sauce tunnel';
    else return tunnel;
}

export function closeTunnel (tunnel) {
    return new Promise(function (resolve, reject) {
        if (!tunnel)
            reject();
        else tunnel.stop(resolve);
    });
}

export async function run (settings) {
    var runner = new SauceLabsRunner(settings);

    return await runner.runTests();
}
