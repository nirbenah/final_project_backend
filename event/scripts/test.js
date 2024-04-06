
import assert from 'assert';
import { v4 as uuidv4 } from "uuid";
import fetch from "node-fetch"

const args = process.argv.slice(2);
assert(args.length <= 1, 'usage: node test.js [url]');

const url = (args.length == 0) ? 'http://localhost:3000' : args[0];

function sendRequest(endpoint, method = 'GET', body = '', headers = {}) {
    const address = `${url}${endpoint}`;
    const content = {
        method: method,
        headers: headers
    }
    if (body) {
        content['body'] = body
    }
    return fetch(address, content)

}

async function baseTest() {

    // let res = await sendRequest('/api/segel')
    // assert.equal(res.status, 401)

    let user = uuidv4().substring(0, 8);
    let pass = '1234'
    let reqBody = JSON.stringify({ username: user, password: pass })
    let res = await sendRequest('/api/signup', 'POST', reqBody)
    assert.equal(res.status, 201)

    res = await sendRequest('/api/login', 'POST', reqBody)
    assert.equal(res.status, 200)
    let jwt = (await res.json()).token
    assert(jwt)

    // res = await sendRequest('/api/segel', 'GET', '', { authorization: `Bearer ${jwt}`})
    // assert.equal(res.status, 200)

    console.log('Basic Test - Passed')
}

baseTest();


