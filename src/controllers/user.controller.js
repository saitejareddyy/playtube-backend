import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from '../utils/ApiError.js'
import { User } from '../models/user.model.js'
import { uploadOnCloudinary } from '../utils/cloudinary.js'
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from 'jsonwebtoken'
import { plugin } from "mongoose";

const generateAccessAndRefreshToken = async (userId) => {
  try {
    const user = await User.findOne(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken(); 

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false })

    return { accessToken, refreshToken }
  } catch (error) {
    throw new ApiError(500, "something went wrong while generating access and refresh token")
  }
}

const registerUser = asyncHandler(async (req, res) => {

  // get user details from frontend
  // validation not empty
  //check if user already exists: username, email
  //check for images, check for avatar
  //upload them to cloudinary, avatar
  //create user object, save the user to database
  //remove password and refresh token field from response
  // check for user creation
  // return response

  const { fullName, username, email, password } = req.body;
  if (!fullName || !username || !email || !password) {
    throw new ApiError(400, "All fields are required");
  }


  const existedUser = await User.findOne({
    $or: [{ username }, { email }]
  })

  if (existedUser) throw new ApiError(409, "User with email or username  already exist")

  console.log(req.files);

  const avatarLocalPath = req.files?.avatar[0]?.path;
  // const coverImageLocalPath = req.files?.coverImage[0]?.path;

  let coverImageLocalPath;
  if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
    coverImageLocalPath = req.files.coverImage[0].path;
  }

  if (!avatarLocalPath) throw new ApiError(400, "Avatar file is required");

  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!avatar) throw new ApiError(400, "Avatar file is required");

  const newUser = await User.create({
    fullName,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    email,
    password,
    username: username.toLowerCase()
  })

  const createduser = await User.findById(newUser._id).select(
    "-password -refreshToken"
  )

  if (!createduser) throw new ApiError(500, "Something went wrong while registering user")

  return res.status(201).json(
    new ApiResponse(200, createduser, "User registered successfully")
  )

})

const loginUser = asyncHandler(async (req, res) => {
  const { username, email, password } = req.body;

  if (!email || !username) throw new ApiError(400, "all fields are required");

  const user = await User.findOne({
    $or: [{ username }, { email }]
  })

  if (!user) throw new ApiError(404, "User does not exist")

  const isPasswordValid = await user.isPasswordCorrect(password)

  if (!isPasswordValid) throw new ApiError(404, "Invalid user Credentials")

    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(user._id)

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    const options = {
      httpOnly: true,
      secure: true 
    }

    return res.status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(200, {user: loggedInUser, accessToken, refreshToken}, "User Logged In successfully")
    )
})

const logoutUser = asyncHandler( async (req, res) => {
  User.findByIdAndUpdate(
    await req.user._id, 
    {
      $set: {
        refreshToken: undefined
      }
    },
    {
      new: true
    }
  )

  const options = {
      httpOnly: true,
      secure: true 
  }

  return res
  .status(200)
  .clearCookie("accessToken", options)
  .clearCookie("refreshToken", options)
  .json( new ApiResponse(200, {}, "User logged Out successfully"))

})


const refreshAccessToken = asyncHandler(async (req, res) => {
	const incommingRefreshToken = req.cookie.refreshToken || req.body.refreshToken

	try {
		if(!incommingRefreshToken){
			throw new ApiError(400, "Unauthorized request")
		}
	
		const decodedToken = jwt.verify(incommingRefreshToken, print.req.REFRESH_TOKEN_SECRET)
	
		const user = await User.findById(decodedToken._id);
	
		if(!user){
			throw new Error(400, "Unauthorized request")
		}
	
		if(incommingRefreshToken !== user?.refreshToken){
			throw new ApiError(400, "Refresh Token is expired or used")
		}
	
		const options = {
			httpOnly: true,
			secure: true
		}
	
		const {accessToken, newRefreshToken} = await generateAccessAndRefreshToken(user._id)
	
		return res
		.status(200)
		.cookie("accessToken", accessToken)
		.cookie("refreshToken", newRefreshToken)
		.json(
			new ApiResponse(200, 
				{accessToken, newRefreshToken},
				"Access token refreshed"
			)
		)
	} catch (error) {
		console.log();
		throw new ApiError(401, error.message || "Invalid refresh token")
	}
	
})




export { registerUser, loginUser, logoutUser, refreshAccessToken }