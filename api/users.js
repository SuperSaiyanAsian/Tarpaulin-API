const { Router } = require('express')
const { ValidationError } = require('sequelize')

const { Business } = require('../models/business')
const { Photo } = require('../models/photo')
const { Review } = require('../models/review')
const { Course } = require('../models/course')
const { User, UserClientFields } = require('../models/user')
const { generateAuthToken, requireAuthentication } = require('../lib/auth')

const bcrypt = require('bcryptjs');

const router = Router()

/*
 * Route to create a new user.
 */
router.post('/', requireAuthentication, async function (req, res, next) {
  if (req.body.role) {

    if (req.body.role == "admin" || req.body.role == "instructor") {
      const adminCheck = await User.findAll({ attributes: ['role'], where: { id: req.user }})

      if (adminCheck.length > 0) {
        if (adminCheck[0].role != "admin") {
          res.status(403).send({
            error: "Only an authenticated User with the 'admin' role can create users with the 'admin' or 'instructor' roles."
          })
        }
    
        else {
          try {
            const user = await User.create(req.body, UserClientFields)
            res.status(201).send({ id: user.id })
          } catch (e) {
            if (e instanceof ValidationError) {
              res.status(400).send({ error: e.message })
            } else {
              throw e
            }
          }
        }
      }

      else {
        res.status(403).send({
          error: "Unauthenticated user."
        })
      }
    }
  
    else if (req.body.role == "student") {
      try {
        const user = await User.create(req.body, UserClientFields)
        res.status(201).send({ id: user.id })
      } catch (e) {
        if (e instanceof ValidationError) {
          res.status(400).send({ error: e.message })
        } else {
          throw e
        }
      }
    }
  
    else {
      res.status(400).send({ error: "Invalid role. Role must be either 'admin', 'instructor', or 'student'." })
    }
  }

  else {
    res.status(400).send({ error: "Missing 'role' field." })
  }
})

/*
 * Route to log in a registered user.
 */
router.post('/login', async function (req, res) {
  if (req.body && req.body.email && req.body.password) {
      const userId = await User.findAll({ attributes: ['id'], where: { email: req.body.email }})
      const password = await User.findAll({ attributes: ['password'], where: { email: req.body.email }, raw: true})

      const authenticated = password && await bcrypt.compare(
          req.body.password,
          password[0].password
      )
      if (authenticated) {
          const token = generateAuthToken(userId[0].id)
          res.status(200).send({ token: token })
      } else {
          res.status(401).send({
              error: "Invalid credentials"
          })
      }
  } else {
      res.status(400).send({
          error: "Request needs a registered user's email and password."
      })
  }
})

/*
 * Route to return a user's information.
 */
router.get('/:userId', requireAuthentication, async function (req, res, next) {

  const userId = req.params.userId

  console.log("userId: " + userId)
  console.log("req.user: " + req.user)

  if (userId != req.user) {
    res.status(403).send({
      error: "Unauthorized. User's id does not match specified user's id."
  })
  }

  else {
    const roleCheck = await User.findAll({ attributes: ['role'], where: { id: req.user }})

    if (roleCheck.length > 0) {
      if (roleCheck[0].role == "student") {
        const userInfo = await User.findAll({ attributes: ['name', 'email', 'password', 'role'],  where: { id: userId }})
        const courseId = await User.findAll({ attributes: ['courseId'],  where: { id: userId }})
        const courseInfo = await Course.findAll({ attributes: ['id'],  where: { id: courseId[0].courseId }})
  
        if (userInfo.length > 0) {
          res.status(200).json({
            studentInfo: userInfo,
            coursesEnrolled: courseInfo
          })
        }
  
        else {
          res.status(404).send({ error: "User with specified user id not found." })
        }
      }
  
      else if (roleCheck[0].role == "instructor") {
        const userInfo = await User.findAll({ attributes: ['name', 'email', 'password', 'role'],  where: { id: userId }})
        const courseInfo = await Course.findAll({ attributes: ['id'],  where: { instructorId: userId }})
  
        if (userInfo.length > 0) {
          res.status(200).json({
            teacherInfo: userInfo,
            coursesTaught: courseInfo
          })
        }
  
        else {
          res.status(404).send({ error: "User with specified user id not found." })
        }
      }

      else if (roleCheck[0].role == "admin") {
        const userInfo = await User.findAll({ attributes: ['name', 'email', 'password', 'role'],  where: { id: userId }})
  
        if (userInfo.length > 0) {
          res.status(200).json({
            adminInfo: userInfo,
          })
        }
  
        else {
          res.status(404).send({ error: "User with specified user id not found." })
        }
      }
    }

    else {
      res.status(403).send({ error: "User with specified user id not found." })
    }

    
  }
  
})

module.exports = router
