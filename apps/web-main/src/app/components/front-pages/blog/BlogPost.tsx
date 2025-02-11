"use client";
import React from "react";
import { BlogProvider } from "../../../context/BlogContext/index";
import BlogPageList from "./BlogPageList";

const BlogPost = () => {
  return (
    <>
      <BlogProvider>
       <BlogPageList/>
      </BlogProvider>
    </>
  )
}

export default BlogPost
