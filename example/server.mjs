import {TinCanServer} from '../server.mjs';
import {createServer} from 'node:http';
import {randomBytes, createHash, createPublicKey, createVerify} from 'node:crypto';
import assert from 'node:assert/strict';

const server = createServer();

class PublicKeyCredentialDescriptor {
	static pack (obj) {
		return {
			type: 'public-key',
			id: Array.from(obj.id)
		}
	}

	constructor ({id}) {
		this.id = id;
	}
}

function packBuffer (x) {
	return x.toString('hex');
}

function unpackBuffer (x) {
	return Buffer.from(x, 'hex');
}

class Credential {
	static pack (obj) {
		return {...obj};
	}

	static unpack (obj) {
		return Object.assign(new Credential, obj);
	}

	constructor (cred, creationOpts) {
		assert(creationOpts instanceof CredentialCreationOptions);
		assert(cred instanceof PublicKeyCredential);
		assert(cred.response instanceof AuthenticatorAttestationResponse);
		cred.response.ensureValidResponse(creationOpts);

		this.name = creationOpts.name;
		this.id = cred.id;
		this.publicKey = cred.response.publicKey;
		this.publicKeyAlg = cred.response.publicKeyAlg;
		this.rpId = creationOpts.rp.id;
		this.info = creationOpts.info;
	}

	genCredDescriptor () {
		return new PublicKeyCredentialDescriptor({id: this.id});
	}

	ensureValidSignature (data, signature) {
		const pubkey = createPublicKey({
			key: this.publicKey,
			format: 'der',
			type: 'spki'
		});
		const verify = createVerify('sha256');
		data.forEach((x) => verify.update(x));
		const valid = verify.verify(pubkey, signature);
		assert(valid, 'Attestation signature invalid');
	}
}

class CredentialStore {
	constructor () {
		this.creds = new Map();
	}

	add (cred) {
		assert(cred instanceof Credential);
		this.creds.set(cred.name, cred);
	}

	get (name) {
		const cred = this.creds.get(name);
		assert(cred, `User ${name} not found`);
		return cred;
	}

}

class Challenge {
	static pack (obj) {
		return Array.from(obj.challenge);
	}

	static unpack (obj) {
		return new Challenge(Buffer.from(obj));
	}

	constructor (challenge) {
		this.challenge = challenge || randomBytes(32);
		assert(this.challenge instanceof Buffer);
	}

	toBase64URL () {
		return this.challenge.toString('base64')
			.replace(/\+/g, '-')
			.replace(/\//g, '_')
			.replace(/=/g, '');
	}

	ensureMatch (challenge) {
		assert.equal(challenge, this.toBase64URL(), 'Invalid challenge');
	}
}

const store = new CredentialStore();

class CredentialCreationOptions {
	static pack (obj) {
		return {
			publicKey: {
				challenge: obj.challenge,
				rp: obj.rp,
				user: {
					id: Array.from(Buffer.from(obj.name)),
					name: obj.name,
					displayName: obj.name
				},
				pubKeyCredParams: [
					{type: "public-key", alg: -7}
				],
				authenticatorSelection: {
					userVerification: 'discouraged'
				}
			}
		}
	}

	constructor ({name, rp, rpName, info}) {
		// TODO: Assert params
		this.name = name;
		this.rp = {id: rp, name: rpName};
		this.challenge = new Challenge();
		this.info = info;
	}
}

class PublicKeyCredential {
	static unpack ({id, response}) {
		return new PublicKeyCredential({
			id: Buffer.from(id),
			response
		});
	}

	constructor (obj) {
		// TODO: Assert params
		Object.assign(this, obj);
	}
}

class AuthenticatorAttestationResponse {
	static unpack (obj) {
		return new AuthenticatorAttestationResponse({
			publicKey: Buffer.from(obj.publicKey),
			publicKeyAlg: obj.publicKeyAlg,
			clientDataJSON: JSON.parse(obj.clientDataJSON)
		});
	}

	constructor (data) {
		assert.equal(data.clientDataJSON.type, 'webauthn.create', 'Wrong attestion type');
		Object.assign(this, data);
	}

	ensureValidResponse (creation) {
		assert(creation instanceof CredentialCreationOptions);
		creation.challenge.ensureMatch(this.clientDataJSON.challenge);
		// TODO: Check origin
		// TODO: Check rpIdHash
	}
}

function sha256(x) {
	const hash = createHash('sha256');
	hash.update(x);
	return hash.digest();
}

class AuthenticatorAssertionResponse {
	static unpack (obj) {
		return new AuthenticatorAssertionResponse({
			signature: Buffer.from(obj.signature),
			authenticatorData: Buffer.from(obj.authenticatorData),
			clientDataJSON: JSON.parse(obj.clientDataJSON),
			clientDataJSONHash: sha256(obj.clientDataJSON),
		});
	}

	constructor (data) {
		assert.equal(data.clientDataJSON.type, 'webauthn.get', 'Wrong attestion type');
		Object.assign(this, data);
	}

	ensureValidResponse (credReqOpts) {
		assert(credReqOpts instanceof CredentialRequestOptions);
		credReqOpts.challenge.ensureMatch(this.clientDataJSON.challenge);
		// TODO: Check Callenge
		// TODO: Check Origin
		// TODO: Check rpIdHash
		credReqOpts.cred.ensureValidSignature([this.authenticatorData, this.clientDataJSONHash], this.signature);
	}
}

class CredentialRequestOptions {
	static pack (obj) {
		return {
			publicKey: {
				timeout: 60000,
				challenge: obj.challenge,
				allowCredentials: [obj.cred.genCredDescriptor()],
				authenticatorSelection: {
					userVerification: 'discouraged'
				}
			}
		} 
	}

	constructor (cred) {
		assert(cred instanceof Credential);
		this.challenge = new Challenge();
		this.cred = cred;
	}

	getCredentail (loginReg) {
		assert(loginReg instanceof PublicKeyCredential);
		const {response} = loginReg;
		assert(response instanceof AuthenticatorAssertionResponse);
		response.ensureValidResponse(this);
		return this.cred;
	}
}

class ClientProxy {
	startReg (name, info) {
		assert(typeof name === 'string' && name.length > 0);
		this.regOpts = new CredentialCreationOptions({name, info, rp: 'localhost', rpName: 'Foobor'});
		return this.regOpts;
	}

	finishReg (regRequest) {
		const cred = new Credential(regRequest, this.regOpts);
		console.log(this.regOpts, cred);
		store.add(cred);
	}

	startLogin (name) {
		this.loginOpts = new CredentialRequestOptions(store.get(name));
		return this.loginOpts;
	}

	finishLogin (loginReg) {
		this.cred = this.loginOpts.getCredentail(loginReg);
		return this.cred.info;
	}
}

const tcs = new TinCanServer({
	server,
	customTypes: [
		{cls: Challenge},
		{cls: CredentialCreationOptions},
		{cls: AuthenticatorAttestationResponse},
		{cls: AuthenticatorAssertionResponse},
		{cls: PublicKeyCredential},
		{cls: PublicKeyCredentialDescriptor},
		{cls: CredentialRequestOptions},
	],
	onConnection: ({startSession}) => {
		console.log('new session');
		const onDisconnect = () => console.log('closed session');

		startSession({
			onDisconnect,
			proxy: new ClientProxy(),
		});
	}
});

server.listen(8080);
