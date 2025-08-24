import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from '../utils/ApiError.js'
import { User } from '../models/user.model.js'
import { uploadOnCloudinary } from '../utils/cloudinary.js'
import { ApiResponse } from "../utils/ApiResponse.js";

const registerUser = asyncHandler( async (req, res) => {
  
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
  if(!fullName || !username || !email || !password){
    throw new ApiError(400, "All fields are required");
  }


  const existedUser = await User.findOne({
    $or: [{ username }, { email }]
  })

  if(existedUser) throw new ApiError(409, "User with email or username  already exist")

    console.log(req.files);

  const avatarLocalPath = req.files?.avatar[0]?.path;
  // const coverImageLocalPath = req.files?.coverImage[0]?.path;

  let coverImageLocalPath;
  if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0){
    coverImageLocalPath = req.files.coverImage[0].path;
  }

  if(!avatarLocalPath) throw new ApiError(400, "Avatar file is required");

  const avatar =  await uploadOnCloudinary(avatarLocalPath);
  const coverImage =  await uploadOnCloudinary(coverImageLocalPath);

  if(!avatar) throw new ApiError(400, "Avatar file is required");

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

  if(!createduser) throw new ApiError(500, "Something went wrong while registering user")

  return res.status(201).json(
    new ApiResponse(200, createduser, "User registered successfully")
  )
  
})

export { registerUser }