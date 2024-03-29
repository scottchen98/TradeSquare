import express, { Request, Response, NextFunction } from "express";
import {
  createReview,
  getUserReviews,
  getUserByAuth0Id,
  getUserById,
  getUserLikedItems,
  getUserSquares,
} from "../services/user";
import { Category, Item } from "@prisma/client";
import { getObjectSignedUrl } from "../s3";
import { requiresAuth } from "express-openid-connect";

const users = express.Router();

const authenticateMessage = (req: any, res: any, next: any) =>
  !req.oidc.user ? res.redirect(`/test/featureMessagePage`) : next();

users.get("/profile/:id", requiresAuth(), async (req, res, next) => {
  try {
    const id = +req.params.id;
    const user = await getUserById(id);
    if (!user) throw new Error("User not found");
    const userReviews = await getUserReviews(id);
    const userAvgRatings =
      Math.round(
        (userReviews
          .map((review) => review.review.rating)
          .reduce((a, b) => a + b, 0) /
          userReviews.length) *
          2
      ) / 2;
    res.render("pages/profile", {
      user,
      isAuthenticated: req.oidc.isAuthenticated(),
      userAvgRatings: !userAvgRatings ? 0 : userAvgRatings,
      numberOfReviews: userReviews.length,
    });
  } catch (error) {
    next(error);
  }
});

users.get("/my-items", requiresAuth(), async (req, res, next) => {
  try {
    const user = await getUserByAuth0Id(req.oidc.user?.sub);
    if (!user) throw new Error("Please login to view your items");
    const items = user.items;

    for (const item of items) {
      const url = await getObjectSignedUrl(item.imgName);
      (
        item as Item & {
          category: Category;
          imgUrl: string;
        }
      ).imgUrl = url;
    }
    res.render("pages/myLists", { items, user });
  } catch (error) {
    next(error);
  }
});

users.get("/my-squares", requiresAuth(), async (req, res, next) => {
  try {
    const user = await getUserByAuth0Id(req.oidc.user?.sub);
    if (!user) throw new Error("User not found");
    const userSquares = await getUserSquares(user.id);
    if (!userSquares) throw new Error("Cannot find user squares");
    res.render("pages/mySquares", { userSquares, user });
  } catch (error) {
    next(error);
  }
});

users.get("/likes", requiresAuth(), async (req, res, next) => {
  try {
    const user = await getUserByAuth0Id(req.oidc.user?.sub);
    if (!user) throw new Error("Please login to view your liked items");
    const likedItems = await getUserLikedItems(user.id);
    if (!likedItems) throw new Error("Cannot find liked items");
    for (const { item } of likedItems) {
      const url = await getObjectSignedUrl(item.imgName);
      (
        item as Item & {
          category: Category;
          imgUrl: string;
        }
      ).imgUrl = url;
    }
    res.render("pages/likes", {
      likedItems,
      user,
      isAuthenticated: req.oidc.isAuthenticated(),
    });
  } catch (error) {
    next(error);
  }
});

users.get("/mailbox", authenticateMessage, async (req, res, next) => {
  try {
    const user = req.oidc.user
      ? await getUserByAuth0Id(req.oidc.user.sub)
      : null;
    if (!user) throw new Error("User not found");
    res.render("pages/mailbox", {
      user,
      isAuthenticated: req.oidc.isAuthenticated(),
    });
  } catch (error) {
    next(error);
  }
});

users.get("/message/:receiverAuth0Id", async (req, res, next) => {
  try {
    const user = req.oidc.user
      ? await getUserByAuth0Id(req.oidc.user.sub)
      : null;
    if (!user) throw new Error("Can't send message to invalid user");

    const receiver = await getUserByAuth0Id(req.params.receiverAuth0Id);
    (user as any).sid = req.oidc.user?.sid;
    res.render("pages/message.ejs", {
      user,
      receiver,
    });
  } catch (error) {
    next(error);
  }
});

users.get("/:id", async (req, res, next) => {
  try {
    const id = +req.params.id;
    const user = await getUserById(id);
    const sellerReviews = await getUserReviews(id);
    const sellerAvgRatings =
      Math.round(
        (sellerReviews
          .map((review) => review.review.rating)
          .reduce((a, b) => a + b, 0) /
          sellerReviews.length) *
          2
      ) / 2;

    if (!user) throw new Error("User not found");
    for (const item of user.items) {
      const url = await getObjectSignedUrl(item.imgName);
      (
        item as Item & {
          category: Category;
          imgUrl: string;
        }
      ).imgUrl = url;
    }
    res.render("pages/seller", {
      user,
      isAuthenticated: req.oidc.isAuthenticated(),
      sellerAvgRatings: !sellerAvgRatings ? 0 : sellerAvgRatings,
      numberOfReviews: sellerReviews.length,
    });
  } catch (error) {
    next(error);
  }
});

users.get("/:id/rating", async (req, res, next) => {
  try {
    const id = +req.params.id;
    const user = await getUserById(id);
    const sellerReviews = await getUserReviews(id);
    if (!user) throw new Error("User not found");
    res.render("pages/rating", {
      user,
      isAuthenticated: req.oidc.isAuthenticated(),
      sellerReviews,
    });
  } catch (error) {
    next(error);
  }
});

users
  .route("/:id/rating/create")
  .all(requiresAuth())
  .get(async (req, res, next) => {
    try {
      const id = +req.params.id;
      const user = await getUserById(id);
      if (!user) throw new Error("User not found");
      res.render("pages/createReview", {
        user,
        isAuthenticated: req.oidc.isAuthenticated(),
      });
    } catch (error) {
      next(error);
    }
  })
  .post(async (req, res, next) => {
    try {
      const { rating, description } = req.body;
      const sellerId = +req.params.id;
      const sessionUserAuth0Id = req.oidc.user?.sub;
      const sessionUser = await getUserByAuth0Id(sessionUserAuth0Id);
      if (!sessionUser) throw new Error("User not found");
      await createReview(+rating, description, sessionUser.id, sellerId);
      res.redirect(`/users/${sellerId}/rating`);
    } catch (error) {
      next(error);
    }
  });

export default users;
