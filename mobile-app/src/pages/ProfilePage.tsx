import { useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAppSelector, useAppDispatch } from "../hooks/useAppHooks";
import { setProfile } from "../store/slices/profileSlice";
import { setUser } from "../store/slices/authSlice";
import { addNotification } from "../store/slices/uiSlice";
import api from "../utils/axios";
import MobileShell from "../layout/MobileShell";
import { useTranslation } from "react-i18next";

const ProfilePage = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const profile = useAppSelector((state) => state.profile.userData);

  useEffect(() => {
    const loadFromBackend = async () => {
      try {
        const response = await api.get("/users/me");
        const apiUser = response.data?.user;
        if (!apiUser) return;

        const publicId = apiUser.public_id || apiUser.PublicID || apiUser.id || "";
        const fullName = apiUser.full_name || apiUser.fullName || "";
        const email = apiUser.email || "";
        const phone = apiUser.phone_number || "";
        const profilePhotoUrl = apiUser.profile_photo_url || "";

        const mappedUser = {
          id: publicId,
          email,
          fullName,
          role: apiUser.role || "rider",
        };

        dispatch(setUser(mappedUser));
        dispatch(
          setProfile({
            id: publicId,
            email,
            fullName,
            phoneNumber: phone,
            profilePhotoUrl,
          })
        );

        window.localStorage.setItem(
          "authUser",
          JSON.stringify({
            ...mappedUser,
            phoneNumber: phone,
            profilePhotoUrl,
          })
        );
      } catch (err) {
        console.error("Failed to load profile", err);
        navigate("/login", { replace: true });
      }
    };

    loadFromBackend();
  }, [dispatch, navigate]);

  const { t } = useTranslation();
  const data = profile;

  const handleCopyUserId = () => {
    if (!data?.id) return;
    if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(data.id).then(() => {
        const id = `notif-${Date.now()}`;
        dispatch(
          addNotification({
            id,
            message: "Copied!",
            type: "success",
          })
        );
      }).catch((err) => {
        console.error("Failed to copy user ID", err);
      });
    }
  };

  if (!data) {
    return (
      <MobileShell title={t("profile.myProfile")}>{/* fallback while loading */}
        <div className="min-h-[50vh] flex items-center justify-center text-xs">
          {t("profile.loading")}
        </div>
      </MobileShell>
    );
  }

  return (
    <MobileShell title={t("profile.myProfile")} subtitle={t("profile.viewDetails")}>
      <main className="flex-1">
        <div className="max-w-sm mx-auto mt-4 space-y-4">
          <div className="flex items-center space-x-3">
            <div className="h-12 w-12 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-300 text-sm font-semibold">
              {data.fullName && data.fullName !== "-"
                ? data.fullName.charAt(0).toUpperCase()
                : "U"}
            </div>
            <div>
              <p className="text-sm font-semibold">{data.fullName || "-"}</p>
              <p className="text-[11px] text-slate-400">{data.email || "-"}</p>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/60 divide-y divide-slate-800 text-xs">
            <div
              className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-slate-800/40"
              onClick={handleCopyUserId}
            >
              <span className="text-slate-400">{t("profile.userId")}</span>
              <span className="text-slate-100 ml-4 max-w-[55%] truncate text-right">
                {data.id || "-"}
              </span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-slate-400">{t("profile.email")}</span>
              <span className="text-slate-100 ml-4 text-right">
                {data.email || "-"}
              </span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-slate-400">{t("profile.phoneNumber")}</span>
              <span className="text-slate-100 ml-4 text-right">
                {data.phoneNumber || "-"}
              </span>
            </div>
          </div>

          <p className="text-[11px] text-slate-500">{t("profile.copyIdHint")}</p>

          <div className="pt-2 flex justify-end">
            <Link
              to="/profile/edit"
              className="inline-flex items-center rounded-lg bg-emerald-500 px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/70"
            >
              {t("profile.editProfile")}
            </Link>
          </div>
        </div>
      </main>
    </MobileShell>
  );
};

export default ProfilePage;
