import express from "express";
import { getUserByAuth0Id } from "../services/user";

const test = express.Router();

// Do test.get(/<component name>/) for each component you want to test
test.get("/mailbox", async (req, res) => {
  const user = req.oidc.user ? await getUserByAuth0Id(req.oidc.user.sub) : null;
  if (user) {
    res.render("pages/mailbox", { user });
  } else {
    res.status(404).send("Users not found");
    return;
  }
});

test.get("/credentials", (req, res) =>
  res.render("pages/credentials", { state: null })
);

test.get("/message", async (req, res) => {
  const user = req.oidc.user ? await getUserByAuth0Id(req.oidc.user.sub) : null;
  if (!user) {
    res.status(404).send("User not found");
  } else {
    res.render("pages/myMessage");
    (user as any).sid = req.oidc.user?.sid;
    res.render("components/message.ejs", { user, channelId: "test" });

  }
});

test.get("/featureMessagePage", (req, res) => {
  res.render("pages/featurePageMessage");
});


test.get("/preFeatureProfile", (req, res) => {
  res.render("pages/preFeatureProfilePage");

test.get("/categoriesCarousel", (req, res) => {
  res.render("pages/categoriesCarousel");
});

export default test;
