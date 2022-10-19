const { DataTypes } = require('sequelize')

const sequelize = require('../lib/sequelize')

const Assignment = sequelize.define('assignment', {
  courseId: { type: DataTypes.INTEGER, allowNull: false },
  title: { type: DataTypes.STRING, allowNull: false },
  points: { type: DataTypes.INTEGER, allowNull: false },
  due: { type: DataTypes.STRING, allowNull: false } // Should be in ISO 8601 format, e.g., '2022-06-14T17:00:00-07:00'
})

exports.Assignment = Assignment

exports.AssignmentClientFields = [
  'courseId',
  'title',
  'points',
  'due'
]
