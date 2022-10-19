const jwt = require('jsonwebtoken')

const secret = "SuperSecret"

function generateAuthToken(userId) {
    const payload = { sub: userId }
    return jwt.sign(payload, secret, { expiresIn: '24h' })
}
exports.generateAuthToken = generateAuthToken


function requireAuthentication(req, res, next) {
    const authHeader = req.get('authorization') || ''
    const authParts = authHeader.split(' ')
    const token = authParts[0] === 'Bearer' ? authParts[1] : null

    try {
        const payload = jwt.verify(token, secret)
        console.log("== payload:", payload)
        req.user = payload.sub
        next()
    } catch (err) {
        res.status(401).send({
            err: "Invalid authentication token"
        })
    }
}
exports.requireAuthentication = requireAuthentication

function requireAuthentication_Ratelimit(req, res, next) {
    const authHeader = req.get('authorization') || ''
    const authParts = authHeader.split(' ')
    const token = authParts[0] === 'Bearer' ? authParts[1] : null
    console.log("==token:", token);
    // if no token, it's also fine to create user
    if(token == null){
        return false
        //req.user=null
        //next()
    }else{
        try {
            const payload = jwt.verify(token, secret)
            console.log("== payload:", payload)
            //req.user = payload
            return true
            //next()
        } catch (err) {
            return false

            //res.status(401).send({
            //    err: "Invalid authentication token"
            //})
        }
    }

}
exports.requireAuthentication_Ratelimit = requireAuthentication_Ratelimit