const { Router } = require('express')
const { ValidationError } = require('sequelize')

const { User } = require('../models/user')
const { Course, CourseClientFields } = require('../models/course')
const { Assignment } = require('../models/assignment')
const { requireAuthentication } = require('../lib/auth')

const stringify = require('csv-stringify')

const router = Router()

/*
 * Route to create a new course.
 */
router.post('/', requireAuthentication, async function (req, res, next) {
    const roleCheck = await User.findAll({ attributes: ['role'], where: { id: req.user }})

    if (roleCheck[0].role == "admin") {
        try {
            const course = await Course.create(req.body, CourseClientFields)
            res.status(201).send({ id: course.id })
        } catch (e) {
            if (e instanceof ValidationError) {
              res.status(400).send({ error: e.message })
            } else {
              throw e
            }
          }
    }

    else {
        res.status(403).send({ error: "User must have the 'admin' role." })
    }
  })


/*
 * Route to return a list of all courses.
 */
router.get('/', async function (req, res) {
    /*
     * Compute page number based on optional query string parameter `page`.
     * Make sure page is within allowed bounds.
     */
    let page = parseInt(req.query.page) || 1
    page = page < 1 ? 1 : page
    const numPerPage = 10
    const offset = (page - 1) * numPerPage

    const result = await Course.findAndCountAll({
      limit: numPerPage,
      offset: offset
    })

    /*
     * Generate HATEOAS links for surrounding pages.
     */
    const lastPage = Math.ceil(result.count / numPerPage)
    const links = {}
    if (page < lastPage) {
      links.nextPage = `/courses?page=${page + 1}`
      links.lastPage = `/courses?page=${lastPage}`
    }
    if (page > 1) {
      links.prevPage = `/courses?page=${page - 1}`
      links.firstPage = '/courses?page=1'
    }

    /*
     * Construct and send response.
     */
    res.status(200).json({
      courses: result.rows,
      pageNumber: page,
      totalPages: lastPage,
      pageSize: numPerPage,
      totalCount: result.count,
      links: links
    })
  })


/*
 * Route to return summary data for a course.
 */
router.get('/:courseId', async function (req, res, next) {
    const courseId = req.params.courseId
    const courseInfo = await Course.findAll({ attributes: ['subject', 'number', 'title', 'term', 'instructorId'], where: { id: courseId }})

    if (courseInfo.length > 0) {
        res.status(200).json({
            courseInfo: courseInfo
        })
    }

    else {
        res.status(404).send({ error: "Course with specified course id not found." })
    }
  })


/*
 * Route to update a course.
 */
router.patch('/:courseId', requireAuthentication, async function (req, res, next) {

    const roleCheck = await User.findAll({ attributes: ['role'], where: { id: req.user }})

    if (roleCheck[0].role == "admin") {
        const courseId = req.params.courseId

        const result = await Course.update(req.body, {
            where: { id: courseId },
            fields: CourseClientFields })

        if (result[0] > 0) {
            res.status(200).send()
        } else {
            res.status(404).send({ error: "Course with specified course id not found." })
        }
    }

    else if (roleCheck[0].role == "instructor") {
        const instructorCheck = await Course.findAll({ attributes: ['instructorId'], where: { id: req.body.courseId }})

        if (instructorCheck[0].instructorId == req.user) {
            const courseId = req.params.courseId

            const result = await Course.update(req.body, {
                where: { id: courseId },
                fields: CourseClientFields })

            if (result[0] > 0) {
                res.status(200).send()
            } else {
                res.status(404).send({ error: "Course with specified course id not found." })
            }
        }

        else {
            res.status(403).send({ error: "User's ID must match the 'instructorId' of the specified course." })
        }
    }

    else {
        res.status(403).send({ error: "User must have the 'admin' or 'instructor' role." })
    }
  })


/*
 * Route to delete a course and all enrolled students, assignments, etc.
   todo: Still need to delete enrolled students, assignments, etc.
 */
   router.delete('/:courseId', requireAuthentication, async function (req, res, next) {

    const roleCheck = await User.findAll({ attributes: ['role'], where: { id: req.user }})

    if (roleCheck[0].role == "admin") {
        const courseId = req.params.courseId
        
        const result = await Course.destroy({ where: { id: courseId }})
        const result2 = await User.update({courseId: null}, {where:{ courseId: courseId }})
        const result3 = await Assignment.destroy({ where: { courseId: courseId }})

        if (result > 0) {
            res.status(204).send()
        } else {
            res.status(404).send({ error: "Course with specified course id not found." })
        }
    }

    else {
        res.status(403).send({ error: "User must have the 'admin' role." })
    }
  })

// if student has course id, delete
// find by, if student, get course id, split, if not exist, add
/*
 ! Route to update enrollment for a course. ( not sure )
 */
 router.post('/:courseId/students', requireAuthentication, async function (req, res, next) {
  //router.post('/:courseId/students', async function (req, res, next) {
    const courseId = req.params.courseId
    const roleCheck = await User.findAll({ attributes: ['role'], where: { id: req.user }})

    if (roleCheck.length > 0) {
      if (roleCheck[0].role == "admin") {
        // Enroll/unenroll students
        if(req.body.add){
          for (var i = 0; i < req.body.add.length; ++i){

            var result = await User.update({courseId: courseId}, {where:{id: req.body.add[i]}})

            if (result[0] > 0) {
              res.status(204).send()
            } else {
              res.status(404).send({ error: "User with specified user id not found." })
            }
          }
        }

        if(req.body.remove){
          for (var i = 0; i < req.body.remove.length; ++i){
            var result = await User.update({courseId: null}, {where:{id: req.body.remove[i]}})

            if (result[0] > 0) {
              res.status(204).send()
            } else {
              res.status(404).send({ error: "User with specified user id not found." })
            }
          }
        }
    }

    else if (roleCheck[0].role == "instructor") {
        const instructorCheck = await Course.findAll({ attributes: ['instructorId'], where: { id: courseId}})

        if (instructorCheck[0].instructorId == req.user) {
            // Enroll/unenroll students
            if (roleCheck[0].role == "admin") {
              // Enroll/unenroll students
              if(req.body.add){
                for (var i = 0; i < req.body.add.length; ++i){

                  var result = await User.update({courseId: courseId}, {where:{id: req.body.add[i]}})

                  if (result[0] > 0) {
                    res.status(204).send()
                  } else {
                    res.status(404).send({ error: "User with specified user id not found." })
                  }
                }
              }

              if(req.body.remove){
                for (var i = 0; i < req.body.remove.length; ++i){
                  var result = await User.update({courseId: null}, {where:{id: req.body.remove[i]}})

                  if (result[0] > 0) {
                    res.status(204).send()
                  } else {
                    res.status(404).send({ error: "User with specified user id not found." })
                  }
                }
              }
        }

        else {
            res.status(403).send({ error: "User's ID must match the 'instructorId' of the specified course." })
        }
      }

    }else {
        res.status(403).send({ error: "User must have the 'admin' or 'instructor' role." })
    }


   }else {
      res.status(400).send({ error: "Authentication id is invalid." })
    }

  })

/*
 * Route to return enrolled student information for course ( not tested )
 */
router.get('/:courseId/students', requireAuthentication, async function (req, res, next) {
    const roleCheck = await User.findAll({ attributes: ['role'], where: { id: req.user }})

    const courseId = req.params.courseId

    if (roleCheck.length > 0) {
      if (roleCheck[0].role == "admin") {
        const userInfo = await User.findAll({ attributes: ['id'],  where: { courseId: courseId }})

        if (userInfo.length > 0) {
          res.status(200).json({
            enrolledStudents: userInfo
          })
        }

        else {
          res.status(404).send({ error: "Cannot find users enrolled in course corresponding to course id." })
        }
      }

      else if (roleCheck[0].role == "instructor") {
        const instructorCheck = await Course.findAll({ attributes: ['instructorId'], where: { id: courseId}})

        if (instructorCheck[0].instructorId == req.user) {
          const userInfo = await User.findAll({ attributes: ['id'],  where: { courseId: courseId }})

          if (userInfo.length > 0) {
            res.status(200).json({
              enrolledStudents: userInfo
            })
          }

          else {
            res.status(404).send({ error: "Cannot find users enrolled in course corresponding to course id." })
          }
        }else {
            res.status(403).send({ error: "User's ID must match the 'instructorId' of the specified course." })
        }
      }

      else {
        res.status(403).send({ error: "User must have the 'admin' or 'instructor' role." })
      }
    }
    
    else {
      res.status(400).send({ error: "Authentication id is invalid." })
    }



})

/*
 * Route to return assignments for course ( not tested )
 */
router.get('/:courseId/assignments', async function (req, res, next) {
  const courseId = req.params.courseId

  const assignmentInfo = await Assignment.findAll({ attributes: ['id'],  where: { courseId: courseId }})

  if (assignmentInfo.length > 0) {
    res.status(200).json({
      Assignments: assignmentInfo
    })
  }

  else {
    res.status(404).send({ error: "Cannot find any assignment in course corresponding to course id." })
  }

})

router.get('/:courseId/roster', requireAuthentication, async function (req, res, next) {

    const roleCheck = await User.findAll({ attributes: ['role'], where: { id: req.user }})

    const courseId = req.params.courseId

    if (roleCheck.length > 0) {
      if (roleCheck[0].role == "admin") {
        // workspace
        const userInfo = await User.findAll({ attributes: ['id', 'name', 'email'] ,  where: { courseId: courseId }})

        if (userInfo.length > 0) {
          res.setHeader('Content-Type', 'text/csv');
          // res.setHeader('Content-Disposition', 'attachment; filename=\"' + 'CourseID-'+courseId + ':students' + '.csv\"')
          // res.setHeader('Cache-Control', 'no-cache')
          // res.setHeader('Pragma', 'no-cache')
          // stringify(userInfo, { header: true }).pipe(res);
          let message = 'id,name,email\n'
          for(var i =  0; i < userInfo.length; ++i){
            message += userInfo[i].id + ',' + userInfo[i].name + ',' + userInfo[i].email + '\n'
          }
          console.log(message)

          //var data = stringify(userInfo[0].toJSON(), { header: true });
          //console.log("Data: ", data)
          res.status(200).send(message)
        }

        else {
          res.status(404).send({ error: "Cannot find users enrolled in course corresponding to course id." })
        }
      }
      else if (roleCheck[0].role == "instructor") {
        const instructorCheck = await Course.findAll({ attributes: ['instructorId'], where: { id: courseId}})

        if (instructorCheck[0].instructorId == req.user) {
          // workspace
          const userInfo = await User.findAll({ attributes: ['id', 'name', 'email'],  where: { courseId: courseId }})

          if (userInfo.length > 0) {
            res.setHeader('Content-Type', 'text/csv');
            // res.setHeader('Content-Disposition', 'attachment; filename=\"' + 'CourseID-'+courseId + ':students' + '.csv\"')
            // res.setHeader('Cache-Control', 'no-cache')
            // res.setHeader('Pragma', 'no-cache')
            // stringify(userInfo, { header: true }).pipe(res);
            let message = 'id,name,email\n'
            for(var i =  0; i < userInfo.length; ++i){
              message += userInfo[i].id + ',' + userInfo[i].name + ',' + userInfo[i].email + '\n'
            }
            console.log(message)

            //var data = stringify(userInfo[0].toJSON(), { header: true });
            //console.log("Data: ", data)
            res.status(200).send(message)
          }

          else {
            res.status(404).send({ error: "Cannot find users enrolled in course corresponding to course id." })
          }
        }else {
            res.status(403).send({ error: "User's ID must match the 'instructorId' of the specified course." })
        }
      }

      else {
        res.status(403).send({ error: "User must have the 'admin' or 'instructor' role." })
      }
    }else {
      res.status(400).send({ error: "Authentication id is invalid." })
    }
})

module.exports = router