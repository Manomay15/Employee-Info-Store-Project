const employee = require('../models/employee');
const bcrypt = require('bcrypt');

const loginController = async (req, res) => {
    res.status(200).send("loginController Route and Controller");
}

const signupController = async (req, res) => {
    const name = req.body.name;
    const dob = req.body.dob;
    const email = req.body.email;
    const password = req.body.password;
    const address = req.body.address;

    if (!name || !dob || !email || !password || !address) {
        res.status(400).json({ msg: "Please provide complete details" });
    }

    const hashPassword = await bcrypt.hash(password, 10);
    const passToString = hashPassword.toString();

    const createEmployee = await employee.create({ name, dob, email, password: passToString, address });
    res.status(201).json({ createEmployee, msg: "Employee created successfully" });
}

module.exports = {
    loginController,
    signupController
}