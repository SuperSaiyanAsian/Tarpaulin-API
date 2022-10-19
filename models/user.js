const { DataTypes } = require('sequelize')

const sequelize = require('../lib/sequelize')
const bcrypt = require('bcryptjs');

const { Business } = require('./business')
const { Photo } = require('./photo')
const { Review } = require('./review')

const User = sequelize.define('user', {
    name: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, allowNull: false, unique: true },
    password: {
        type: DataTypes.STRING,
        allowNull: false,
        set(value) {
            // Storing passwords in plaintext in the database is terrible.
            // Hashing the value with an appropriate cryptographic hash function is better.
            this.setDataValue('password', bcrypt.hashSync(value, 8));
        }
    },
    role: { type: DataTypes.STRING, allowNull: false }, // "admin", "instructor", or "student"
    courseId: { type: DataTypes.STRING, allowNull: true }
})

/*
* Set up one-to-many relationship between User and Business.
*/
User.hasMany(Business, { foreignKey: { name: 'ownerId', allowNull: false } })
Business.belongsTo(User, {
    foreignKey: 'ownerId'
})

/*
* Set up one-to-many relationship between User and Photo.
*/
User.hasMany(Photo, { foreignKey: { allowNull: false } })
Photo.belongsTo(User)

/*
* Set up one-to-many relationship between User and Photo.
*/
User.hasMany(Review, { foreignKey: { allowNull: false } })
Review.belongsTo(User)

exports.User = User

/*
 * Export an array containing the names of fields the client is allowed to set
 * on users.
 */
exports.UserClientFields = [
    'name',
    'email',
    'password',
    'role',
    'courseId'
]
