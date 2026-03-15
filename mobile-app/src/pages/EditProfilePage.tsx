import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../utils/axios";
import { useAppDispatch, useAppSelector } from "../hooks/useAppHooks";
import { setProfile } from "../store/slices/profileSlice";
import { setUser } from "../store/slices/authSlice";
import { addNotification } from "../store/slices/uiSlice";
import MobileShell from "../layout/MobileShell";

const EditProfilePage = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const authUser = useAppSelector((state) => state.auth.user);
  const profile = useAppSelector((state) => state.profile.userData);

  const [fullName, setFullName] = useState(
    profile?.fullName || authUser?.fullName || ""
  );
  const [email, setEmail] = useState(profile?.email || authUser?.email || "");
  const [phoneNumber, setPhoneNumber] = useState(
    profile?.phoneNumber || ""
  );
  const [userId, setUserId] = useState<string | null>(
    profile?.id || authUser?.id || null
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState({
    fullName: "",
    email: "",
    phoneNumber: "",
  });

  useEffect(() => {
    const loadFromBackend = async () => {
      try {
        const response = await api.get("/users/me");
        const apiUser = response.data?.user;
        if (!apiUser) {
          navigate("/login", { replace: true });
          return;
        }

        const publicId = apiUser.public_id || apiUser.PublicID || apiUser.id || "";
        const fullName = apiUser.full_name || apiUser.fullName || "";
        const email = apiUser.email || "";
        const phone = apiUser.phone_number || "";
        const profilePhotoUrl = apiUser.profile_photo_url || "";

        setUserId(publicId || null);
        setFullName(fullName);
        setEmail(email);
        setPhoneNumber(phone);

        const mappedUser = {
          id: publicId,
          email,
          fullName,
          role: apiUser.role || authUser?.role || "rider",
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

        localStorage.setItem(
          "authUser",
          JSON.stringify({
            ...mappedUser,
            phoneNumber: phone,
            profilePhotoUrl,
          })
        );
      } catch (err) {
        console.error("Failed to load profile for edit", err);
        navigate("/login", { replace: true });
      }
    };

    loadFromBackend();
  }, [dispatch, navigate, authUser?.role]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const trimmedFullName = fullName.trim();
    const trimmedEmail = email.trim();
    const trimmedPhone = phoneNumber.trim();

    const nextFieldErrors = {
      fullName: "" as string,
      email: "" as string,
      phoneNumber: "" as string,
    };

    if (!trimmedFullName) {
      nextFieldErrors.fullName = "Full name is required";
    }

    if (!trimmedEmail) {
      nextFieldErrors.email = "Email is required";
    } else if (!/^\S+@\S+\.\S+$/.test(trimmedEmail)) {
      nextFieldErrors.email = "Enter a valid email address";
    }

    if (!trimmedPhone) {
      nextFieldErrors.phoneNumber = "Phone number is required";
    }

    setFieldErrors(nextFieldErrors);

    if (nextFieldErrors.fullName || nextFieldErrors.email || nextFieldErrors.phoneNumber) {
      return;
    }

    try {
      setSaving(true);
      const response = await api.put(`/users/me`, {
        full_name: trimmedFullName,
        email: trimmedEmail,
        phone_number: trimmedPhone,
        profile_photo_url: "",
      });

      const updated = response.data?.user;
      if (updated) {
        // Update profile slice
        dispatch(
          setProfile({
            id: updated.public_id || updated.PublicID || updated.id,
            email: updated.email,
            fullName: updated.full_name || updated.fullName || trimmedFullName,
            phoneNumber: updated.phone_number || trimmedPhone,
            profilePhotoUrl: updated.profile_photo_url || "",
          })
        );

        // Update auth slice basic user info
        dispatch(
          setUser({
            id: updated.public_id || updated.PublicID || updated.id,
            email: updated.email,
            fullName: updated.full_name || updated.fullName || trimmedFullName,
            role: authUser?.role || "rider",
          })
        );

        // Persist to localStorage
        const storedUser = {
          id: updated.public_id || updated.PublicID || updated.id,
          email: updated.email,
          fullName: updated.full_name || updated.fullName || trimmedFullName,
          phoneNumber: updated.phone_number || trimmedPhone,
          profilePhotoUrl: updated.profile_photo_url || "",
          role: authUser?.role || "rider",
        };
        localStorage.setItem("authUser", JSON.stringify(storedUser));

        setSuccess("Profile updated successfully");
        setTimeout(() => {
          navigate("/profile", { replace: true });
        }, 900);
      } else {
        setError("Could not update profile. Please try again.");
      }
    } catch (err) {
      console.error("Update profile failed", err);
      setError("Could not update profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleCopyUserId = () => {
    if (!userId) return;
    if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(userId).then(() => {
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

  return (
    <MobileShell title="Edit profile" subtitle="Update your account information." showBackButton>
      <main className="flex-1">
        <form
          onSubmit={handleSubmit}
          className="max-w-sm mx-auto mt-4 space-y-3 text-xs"
        >
          {error && (
            <div className="mb-2 rounded-lg bg-red-500/10 border border-red-500/40 px-3 py-2 text-red-200">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-2 rounded-lg bg-emerald-500/10 border border-emerald-500/40 px-3 py-2 text-emerald-200">
              {success}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-200 mb-1">
              User ID
            </label>
            <input
              type="text"
              value={userId || ""}
              readOnly
              onClick={handleCopyUserId}
              className="w-full rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs text-slate-400 cursor-pointer hover:border-emerald-500/60"
            />
            <p className="mt-1 text-[11px] text-slate-500">
              Tap the ID to copy it. This ID is unique to your account and cannot be changed.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-200 mb-1">
              Username <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className={
                "w-full rounded-lg border bg-slate-900/60 px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 " +
                (fieldErrors.fullName
                  ? "border-red-500 focus:ring-red-500 focus:border-red-500"
                  : "border-slate-700 focus:ring-emerald-500/70 focus:border-emerald-500/70")
              }
              placeholder="John Doe"
            />
            {fieldErrors.fullName && (
              <p className="mt-1 text-[11px] text-red-300">{fieldErrors.fullName}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-200 mb-1">
              Email <span className="text-red-400">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={
                "w-full rounded-lg border bg-slate-900/60 px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 " +
                (fieldErrors.email
                  ? "border-red-500 focus:ring-red-500 focus:border-red-500"
                  : "border-slate-700 focus:ring-emerald-500/70 focus:border-emerald-500/70")
              }
              placeholder="you@example.com"
            />
            {fieldErrors.email && (
              <p className="mt-1 text-[11px] text-red-300">{fieldErrors.email}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-200 mb-1">
              Phone number <span className="text-red-400">*</span>
            </label>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              required
              className={
                "w-full rounded-lg border bg-slate-900/60 px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 " +
                (fieldErrors.phoneNumber
                  ? "border-red-500 focus:ring-red-500 focus:border-red-500"
                  : "border-slate-700 focus:ring-emerald-500/70 focus:border-emerald-500/70")
              }
              placeholder="07XXXXXXXX"
            />
            {fieldErrors.phoneNumber && (
              <p className="mt-1 text-[11px] text-red-300">{fieldErrors.phoneNumber}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={saving}
            className="mt-2 inline-flex w-full items-center justify-center rounded-lg bg-emerald-500 px-4 py-2.5 text-xs font-medium text-white shadow-sm transition hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:ring-offset-0 disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
        </form>
      </main>
    </MobileShell>
  );
};

export default EditProfilePage;
