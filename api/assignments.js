const { Router } = require('express')
const sequelize = require('../lib/sequelize')
const { ValidationError } = require('sequelize')

const { User } = require('../models/user')
const { Course } = require('../models/course')
const { Assignment, AssignmentClientFields } = require('../models/assignment')
const { Submission, SubmissionClientFields } = require('../models/submission')
const { requireAuthentication } = require('../lib/auth')

const multer = require('multer')
const crypto = require('crypto')

const fileTypes = {
    'image/jpeg': 'jpg',
    'image/png': 'png'
  }

const upload = multer({
    storage: multer.diskStorage({
      destination: `${__dirname}/uploads`,
      filename: function (req, file, callback) {
        const ext = fileTypes[file.mimetype]
        const filename = crypto.pseudoRandomBytes(16).toString('hex')
        callback(null, `${filename}.${ext}`)
      }
    }),
    fileFilter: function (req, file, callback) {
      callback(null, !!fileTypes[file.mimetype])
    }
  })

const router = Router()

/*
 * Route to create a new assignment.
 */
router.post('/', requireAuthentication, async function (req, res, next) {
    const roleCheck = await User.findAll({ attributes: ['role'], where: { id: req.user }})

    if (roleCheck[0].role == "admin") {
        try {
            const assignment = await Assignment.create(req.body, AssignmentClientFields)
            res.status(201).send({ id: assignment.id })
        } catch (e) {
            if (e instanceof ValidationError) {
              res.status(400).send({ error: e.message })
            } else {
              throw e
            }
          }
    }

    else if (roleCheck[0].role == "instructor") {
        const instructorCheck = await Course.findAll({ attributes: ['instructorId'], where: { id: req.body.courseId }})

        if (instructorCheck[0].instructorId == req.user) {
            try {
                const assignment = await Assignment.create(req.body, AssignmentClientFields)
                res.status(201).send({ id: assignment.id })
            } catch (e) {
                if (e instanceof ValidationError) {
                  res.status(400).send({ error: e.message })
                } else {
                  throw e
                }
              }
        }

        else {
            res.status(403).send({ error: "User's ID must match the 'instructorId' of the Course corresponding to the Assignment's 'courseId'." })
        }
    }

    else {
        res.status(403).send({ error: "User must have the 'admin' or 'instructor' role." })
    }
  })

/*
 * Route to return summary data for an assignment.
 */
router.get('/:assignmentId', async function (req, res, next) {
    const assignmentId = req.params.assignmentId
    const assignmentInfo = await Assignment.findAll({ attributes: ['courseId', 'title', 'points', 'due'], where: { id: assignmentId }})
    
    if (assignmentInfo.length > 0) {
        res.status(200).json({
            assignmentInfo: assignmentInfo
        })
    } 
    
    else {
        res.status(404).send({ error: "Assignment with specified assignment id not found." })
    }
  })

/*
 * Route to update an assignment.
 */
router.patch('/:assignmentId', requireAuthentication, async function (req, res, next) {
    
    const roleCheck = await User.findAll({ attributes: ['role'], where: { id: req.user }})

    if (roleCheck[0].role == "admin") {
        const assignmentId = req.params.assignmentId
       
        const result = await Assignment.update(req.body, { 
            where: { id: assignmentId },
            fields: AssignmentClientFields })
        
        if (result[0] > 0) {
            res.status(200).send()
        } else {
            res.status(404).send({ error: "Assignment with specified assignment id not found." })
        }
    }

    else if (roleCheck[0].role == "instructor") {
        const instructorCheck = await Course.findAll({ attributes: ['instructorId'], where: { id: req.body.courseId }})

        if (instructorCheck[0].instructorId == req.user) {
            const assignmentId = req.params.assignmentId
       
            const result = await Assignment.update(req.body, { 
                where: { id: assignmentId },
                fields: AssignmentClientFields })
            
            if (result[0] > 0) {
                res.status(200).send()
            } else {
                res.status(404).send({ error: "Assignment with specified assignment id not found." })
            }
        }

        else {
            res.status(403).send({ error: "User's ID must match the 'instructorId' of the Course corresponding to the Assignment's 'courseId'." })
        }
    }

    else {
        res.status(403).send({ error: "User must have the 'admin' or 'instructor' role." })
    }
  })

/*
 * Route to delete an assignment and all submissions.
   todo: Still need to delete submissions
 */
router.delete('/:assignmentId', requireAuthentication, async function (req, res, next) {

    const roleCheck = await User.findAll({ attributes: ['role'], where: { id: req.user }})

    if (roleCheck[0].role == "admin") {
        const assignmentId = req.params.assignmentId

        const result = await Assignment.destroy({ where: { id: assignmentId }})
        const result2 = await Submission.destroy({ where: { assignmentId: assignmentId }})

        if (result > 0) {
            res.status(204).send()
        } else {
            res.status(404).send({ error: "Assignment with specified assignment id not found." })
        }
    }

    else if (roleCheck[0].role == "instructor") {
        const instructorCheck = await Course.findAll({ attributes: ['instructorId'], where: { id: req.body.courseId }})

        if (instructorCheck[0].instructorId == req.user) {
            const assignmentId = req.params.assignmentId
            const result = await Assignment.destroy({ where: { id: assignmentId }})
            const result2 = await Submission.destroy({ where: { assignmentId: assignmentId }})

            if (result > 0) {
                res.status(204).send()
            } else {
                res.status(404).send({ error: "Assignment with specified assignment id not found." })
            }
        }

        else {
            res.status(403).send({ error: "User's ID must match the 'instructorId' of the Course corresponding to the Assignment's 'courseId'." })
        }
    }

    else {
        res.status(403).send({ error: "User must have the 'admin' or 'instructor' role." })
    }
  })

/*
 ! Route to create a new submission.
 */
router.post('/:assignmentId/submissions', upload.single('file'), requireAuthentication, async function (req, res, next) {

    const roleCheck = await User.findAll({ attributes: ['role'], where: { id: req.user }})

    if (roleCheck[0].role == "student") {
        const assignmentId = req.params.assignmentId

        const courseCheck = await Assignment.findAll({ attributes: ['courseId'], where: { id: assignmentId }})
        const enrollmentCheck = await User.findAll({ attributes: ['courseId'], where: { id: req.user }})

        if (courseCheck.length > 0 && enrollmentCheck.length > 0){
            
            if (courseCheck[0].courseId == enrollmentCheck[0].courseId){
                if (req.file) {
                    console.log("== req.file:", req.file)
                    console.log("== req.body:", req.body)

                    req.body.assignmentId = parseInt(assignmentId)
                    req.body.studentId = req.user
                    req.body.timestamp = new Date().toISOString()
                    req.body.grade = null
                    req.body.file = req.file.path

                    console.log("== req.body:", req.body)

                    try {

                        const assignment = await Submission.create(req.body, SubmissionClientFields)
                        res.status(201).send({ id: assignment.id })
                    } catch (e) {
                        if (e instanceof ValidationError) {
                          res.status(400).send({ error: e.message })
                        } else {
                          throw e
                        }
                      }
                }
    
                else {
                    res.status(400).send({
                        error: "Request body needs a valid 'file'."
                      })
                }
            }
    
            else {
                res.status(403).send({ error: "User must be enrolled in the course corresponding to the assignment's course id." })
            }
        }

        else {
            res.status(400).send({ error: "Invalid assignment id provided." })
        }
    }

    else {
        res.status(403).send({ error: "User must have the 'student' role." })
    }
  })


/*
 * Route to return a list of all submissions for an assignment.
 */
router.get('/:assignmentId/submissions', requireAuthentication, async function (req, res) {
    const assignmentId = req.params.assignmentId

    /*
     * Compute page number based on optional query string parameter `page`.
     * Make sure page is within allowed bounds.
     */
    let page = parseInt(req.query.page) || 1
    page = page < 1 ? 1 : page
    const numPerPage = 3
    const offset = (page - 1) * numPerPage

    const roleCheck = await User.findAll({ attributes: ['role'], where: { id: req.user }})

    if (roleCheck[0].role == "admin") {
        const result = await Submission.findAndCountAll({
            attributes: ['assignmentId', 'studentId', 'timestamp', 'grade', 'file'],
            where: { assignmentId: assignmentId },
            limit: numPerPage,
            offset: offset
        })
    
        /*
         * Generate HATEOAS links for surrounding pages.
         */
        const lastPage = Math.ceil(result.count / numPerPage)
        const links = {}
        if (page < lastPage) {
          links.nextPage = `/${assignmentId}/submissions?page=${page + 1}`
          links.lastPage = `${assignmentId}/submissions?page=${lastPage}`
        }
        if (page > 1) {
          links.prevPage = `${assignmentId}/submissions?page=${page - 1}`
          links.firstPage = `${assignmentId}/submissions?page=1`
        }
    
        /*
         * Construct and send response.
         */
        res.status(200).json({
          submissions: result.rows,
          pageNumber: page,
          totalPages: lastPage,
          pageSize: numPerPage,
          totalCount: result.count,
          links: links
        })
    }

    else if (roleCheck[0].role == "instructor") {
        const instructorCheck = await Course.findAll({ attributes: ['instructorId'], where: { id: req.body.courseId }})

        if (instructorCheck[0].instructorId == req.user) {
            const result = await Submission.findAndCountAll({
                where: { assignmentId: assignmentId },
                limit: numPerPage,
                offset: offset
            })
        
            /*
             * Generate HATEOAS links for surrounding pages.
             */
            const lastPage = Math.ceil(result.count / numPerPage)
            const links = {}
            if (page < lastPage) {
              links.nextPage = `/${assignmentId}/submissions?page=${page + 1}`
              links.lastPage = `${assignmentId}/submissions?page=${lastPage}`
            }
            if (page > 1) {
              links.prevPage = `${assignmentId}/submissions?page=${page - 1}`
              links.firstPage = `${assignmentId}/submissions?page=1`
            }
        
            /*
             * Construct and send response.
             */
            res.status(200).json({
              submissions: result.rows,
              pageNumber: page,
              totalPages: lastPage,
              pageSize: numPerPage,
              totalCount: result.count,
              links: links
            })
        }

        else {
            res.status(403).send({ error: "User's ID must match the 'instructorId' of the Course corresponding to the Assignment's 'courseId'." })
        }
    }

    else {
        res.status(403).send({ error: "User must have the 'admin' or 'instructor' role." })
    }
  })


module.exports = router
