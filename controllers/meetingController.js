const meeting = require('../models/meeting');
const employee = require('../models/employee');

const { badRequestError, customAPIError } = require('../errors/')

const getAllMeetingDetails = async (req, res) => {
    let queryObject = {};
    if (req.body.meetCreatedBy) {
        queryObject.meetCreatedBy = req.body.meetCreatedBy;
    }

    if (req.body.particularValue) {
        queryObject.particularValue = req.body.particularValue;
    }

    let limit = parseInt(req.query.limit) || 10;
    let page = parseInt(req.query.page) || 1;
    let skip = (page - 1) * limit;
    const allMeetings = await meeting.find(queryObject).skip(skip).limit(limit);

    const totalMeetings = await meeting.countDocuments(queryObject.meetCreatedBy);
    const numberOfPages = Math.ceil(totalMeetings / limit);
    let particularMember = [];

    for (let i = 0; i < allMeetings.length; i++) {
        let meetMembersArray = [];

        for (let j = 0; j < allMeetings[i].meetMembers.length; j++) {
            const findMeetMembersName = await employee.findOne({ email: allMeetings[i].meetMembers[j] });

            if (queryObject.particularValue) {
                const findParticularMeet = await meeting.aggregate([{ $match: { 'meetMembers': queryObject.particularValue } }]);

                if (findParticularMeet) {
                    particularMember = findParticularMeet;
                }
            }

            if (findMeetMembersName) {
                meetMembersArray.push(findMeetMembersName.name);
            }
        }

        allMeetings[i].meetMembers = meetMembersArray;
    }

    res.status(200).json({ allMeetings, totalMeetings, numberOfPages, particularMember });
};

const getIndividualMeetingDetails = async (req, res) => {
    const meetID = req.params.id;

    const individualMeetDetails = await meeting.findOne({ _id: meetID });

    if (individualMeetDetails) {
        res.status(200).json({ individualMeetDetails });
    }
    else {
        throw new badRequestError('Please provide correct meet ID');
    }
};

const createMeetingDetails = async (req, res) => {
    const { meetTitle, meetCreatedBy } = req.body;
    let meetingRoom = req.body.meetingRoom;
    let meetStartingTime = req.body.meetStartingTime;
    let meetEndingTime = req.body.meetEndingTime;
    let meetMembers = req.body.meetMembers;
    meetMembers = meetMembers.replace(' ', '').split(',');
    meetMembers.push(meetCreatedBy);
    meetStartingTime = meetStartingTime.split(':')[0].concat(':00');
    meetEndingTime = meetEndingTime.split(':')[0].concat(':00');

    if (!meetTitle && !meetCreatedBy && !meetStartingTime && !meetEndingTime && !meetMembers) {
        throw new badRequestError('Please provide complete details');
    }
    else {
        const memberAlreadyMeet = [];
        const totalDuration = (meetEndingTime - meetStartingTime) / 3600000;
        const memberName = [];
        console.log(meetingRoom)
        const findMeetRoomSchedule = await meeting.findOne({ meetingRoom, meetStartingTime, meetEndingTime });
        if (!findMeetRoomSchedule) {
            for (let i = 0; i < meetMembers.length; i++) {
                const memberResult = await employee.findOne({ email: meetMembers[i] }).select('name');

                if (memberResult) {
                    memberName.push(memberResult.name);
                }
                else {
                    throw new badRequestError("Employee not found");
                }
                const isMemberConflict = await meeting.findOne({ meetMembers: meetMembers[i], meetStartingTime, meetEndingTime });

                if (isMemberConflict) {
                    memberAlreadyMeet.push(memberName[i]);
                }
            }

            if (memberAlreadyMeet.length == 0) {
                const createMeeting = await meeting.create({ meetingRoom, meetTitle, meetCreatedBy, meetMembers, meetStartingTime, meetEndingTime });
                res.status(201).json({ createMeeting, msg: "Meet created successfully" });
            }
            else {
                throw new badRequestError(`[${memberAlreadyMeet}] is already in meet for particular slot`);
            }
        }
        else {
            const previousMeetTiming = findMeetRoomSchedule.meetEndingTime;
            console.log(previousMeetTiming, new Date(meetStartingTime))
            let remainingTime = previousMeetTiming.getTime() - new Date(meetStartingTime).getTime();
            remainingTime = remainingTime / 60000;
            let otherMeetRooms = [];
            for (let i = 1; i < 7; i++) {
                if (i == meetingRoom) {
                    continue;
                }
                else {
                    const findOtherRoom = await meeting.findOne({ meetingRoom: i, meetStartingTime, meetEndingTime });
                    if (!findOtherRoom) {
                        otherMeetRooms.push(i);
                    }
                }
            }

            if (otherMeetRooms.length === 0) {
                throw new badRequestError('No meeting room available for the slot');
            }
            else {
                throw new customAPIError(`Meeting Room Booked. Remaining Time - ${remainingTime} minutes. ${otherMeetRooms} Rooms available for the slot`)
            }
        }

    }
}


const updateIndividualMeetingDetails = async (req, res) => {
    const { meetTitle, meetCreatedBy, meetingRoom } = req.body;
    let meetStartingTime = req.body.meetStartingTime;
    let meetEndingTime = req.body.meetEndingTime;

    let meetMembers = req.body.meetMembers;
    const meetID = req.params.id;
    meetMembers = meetMembers.replace(' ', '').split(',');
    meetStartingTime = meetStartingTime.split(':')[0].concat(':00');
    meetEndingTime = meetEndingTime.split(':')[0].concat(':00');

    if (!meetTitle || !meetCreatedBy || !meetStartingTime || !meetEndingTime || !meetMembers) {
        throw new badRequestError('Please provide any details');
    }

    else {
        const findMeetRoomSchedule = await meeting.findOne({ meetingRoom, meetStartingTime, meetEndingTime });
        if (!findMeetRoomSchedule) {
            const isMeet = await meeting.findById({ _id: meetID });
            if (isMeet) {
                const memberAlreadyMeet = [];
                const memberName = [];

                for (let i = 0; i < meetMembers.length; i++) {
                    const memberResult = await employee.findOne({ email: meetMembers[i] }).select('name');
                    memberName.push(memberResult.name);
                    const isMemberConflict = await meeting.findOne({ meetMembers: meetMembers[i], meetStartingTime: meetStartingTime, meetEndingTime: meetEndingTime });

                    if (isMemberConflict) {
                        memberAlreadyMeet.push(memberName[i]);
                    }
                }

                if (memberAlreadyMeet.length == 0) {
                    const updateMeeting = await meeting.findByIdAndUpdate({ _id: meetID }, { meetTitle, meetCreatedBy, meetMembers, meetStartingTime, meetEndingTime }, { new: true, runValidators: true });
                    res.status(200).json({ updateMeeting, msg: "Meet updated successfully" });
                }
                else {
                    throw new badRequestError(`[${memberAlreadyMeet}] is already in meeting`);
                }
            }
            else {
                throw new badRequestError(`No meeting found with the ID`);
            }
        }
        else {
            let otherMeetRooms = [];
            for (let i = 1; i < 7; i++) {
                if (i == meetingRoom) {
                    continue;
                }
                else {
                    const findOtherRoom = await meeting.findOne({ meetingRoom: i, meetStartingTime, meetEndingTime });
                    if (!findOtherRoom) {
                        otherMeetRooms.push(i);
                    }
                }
            }

            if (otherMeetRooms.length === 0) {
                throw new badRequestError('No meeting room available for the slot');
            }
            else {
                throw new customAPIError(`Meeting Room Booked. ${otherMeetRooms} Rooms available for the slot`)
            }
        }
    }
};

const deleteMeeting = async (req, res) => {
    const meetID = req.params.id;

    const deleteMeet = await meeting.findByIdAndRemove({ _id: meetID });

    if (deleteMeet) {
        res.status(200).json({ deleteMeet, msg: "Meeting deleted succesfully" });
    }
    else {
        throw new badRequestError('Please provide correct meet ID');
    }
};

const abortFromMeeting = async (req, res) => {
    const userID = req.user.email;
    const meetID = req.params.id;
    console.log(userID, meetID)

    const isUserMeet = await meeting.findOne({ _id: meetID, meetMembers: userID });
    if (isUserMeet) {
        const abortMeet = await meeting.updateOne(
            {
                _id: meetID
            },
            {
                $pull: {
                    meetMembers: userID
                }
            },
        );

        if (abortMeet) {
            res.status(200).json({ msg: `${userID} abort the meet participation` });
        }
    }
    else {
        throw new badRequestError('Please provide correct meet ID or User not in Meet');
    }
};

const getMeetingByIndividual = async (req, res) => {
    const particularValue = req.user.email;
    if (particularValue) {
        const findParticularMeet = await meeting.aggregate([{ $match: { 'meetMembers': `${particularValue}` } }]);
        if (findParticularMeet) {
            for (let i = 0; i < findParticularMeet.length; i++) {
                let getArrayName = [];
                for (let j = 0; j < findParticularMeet[i].meetMembers.length; j++) {
                    const getName = await employee.findOne({ email: findParticularMeet[i].meetMembers[j] });
                    if (getName) {
                        getArrayName.push(getName.name);
                    }
                }
                findParticularMeet[i].meetMembers = getArrayName;
            }

            console.log(findParticularMeet)

            res.status(200).json({ findParticularMeet });
        }
        else {
            throw new customAPIError('No Meetings')
        }
    }
    else {
        throw new badRequestError('Requires particularValue');

    }
}
module.exports = { getMeetingByIndividual, getAllMeetingDetails, createMeetingDetails, getIndividualMeetingDetails, abortFromMeeting, updateIndividualMeetingDetails, deleteMeeting }