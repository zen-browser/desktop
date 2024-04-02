NS_IMETHODIMP
nsToolkitProfile::GetZenAvatarPath(nsACString& aResult) {
  aResult = mZenAvatarPath;
  return NS_OK;
}

NS_IMETHODIMP
nsToolkitProfile::SetZenAvatarPath(const nsACString& aZenAvatar) {
  NS_ASSERTION(nsToolkitProfileService::gService, "Where did my service go?");

  if (mZenAvatarPath.Equals(aZenAvatar)) {
    return NS_OK;
  }

  mZenAvatarPath = aZenAvatar;

  nsresult rv = nsToolkitProfileService::gService->mProfileDB.SetString(
      mSection.get(), "ZenAvatarPath", mZenAvatarPath.get());
  NS_ENSURE_SUCCESS(rv, rv);
  return NS_OK;
}