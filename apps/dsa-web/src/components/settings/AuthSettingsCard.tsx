import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { authApi } from '../../api/auth';
import { getParsedApiError, isParsedApiError, type ParsedApiError } from '../../api/error';
import { useAuth } from '../../hooks';
import { Badge, Button, Input, Checkbox } from '../common';
import { SettingsAlert } from './SettingsAlert';
import { SettingsSectionCard } from './SettingsSectionCard';

function createNextModeLabel(authEnabled: boolean, desiredEnabled: boolean) {
  if (authEnabled && !desiredEnabled) {
    return 'Tắt xác thực';
  }
  if (!authEnabled && desiredEnabled) {
    return 'Bật xác thực';
  }
  return authEnabled ? 'Giữ đang bật' : 'Giữ đang tắt';
}

export const AuthSettingsCard: React.FC = () => {
  const { authEnabled, setupState, refreshStatus } = useAuth();
  const [desiredEnabled, setDesiredEnabled] = useState(authEnabled);
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | ParsedApiError | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const isDirty = desiredEnabled !== authEnabled || currentPassword || password || passwordConfirm;
  const targetActionLabel = createNextModeLabel(authEnabled, desiredEnabled);

  const helperText = useMemo(() => {
    switch (setupState) {
      case 'no_password':
        return 'Hệ thống chưa có mật khẩu. Hãy đặt mật khẩu quản trị trước khi bật xác thực và giữ cẩn thận.';
      case 'password_retained':
        return 'Hệ thống đã lưu mật khẩu quản trị trước đó. Nhập mật khẩu hiện tại để bật lại xác thực nhanh chóng.';
      case 'enabled':
        return !desiredEnabled
          ? 'Nếu phiên đăng nhập còn hiệu lực, có thể tắt xác thực trực tiếp; nếu phiên đã hết hạn, hãy nhập mật khẩu quản trị hiện tại.'
          : 'Xác thực quản trị đã được bật. Để cập nhật mật khẩu, hãy dùng chức năng "Đổi mật khẩu" bên dưới.';
      default:
        return 'Xác thực quản trị bảo vệ trang cài đặt Web và các API, ngăn chặn truy cập trái phép.';
    }
  }, [setupState, desiredEnabled]);

  useEffect(() => {
    setDesiredEnabled(authEnabled);
  }, [authEnabled]);

  const resetForm = () => {
    setCurrentPassword('');
    setPassword('');
    setPasswordConfirm('');
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);

    // Initial setup validation
    if (setupState === 'no_password' && desiredEnabled) {
      if (!password) {
        setError('Đặt mật khẩu mới là bắt buộc');
        return;
      }
      if (password !== passwordConfirm) {
        setError('Hai lần nhập mật khẩu mới không khớp');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await authApi.updateSettings(
        desiredEnabled,
        password.trim() || undefined,
        passwordConfirm.trim() || undefined,
        currentPassword.trim() || undefined,
      );
      await refreshStatus();
      setSuccessMessage(desiredEnabled ? 'Cài đặt xác thực đã được cập nhật' : 'Xác thực đã tắt');
      resetForm();
    } catch (err: unknown) {
      setError(getParsedApiError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SettingsSectionCard
      title="Xác thực & Bảo vệ đăng nhập"
      description="Quản lý xác thực mật khẩu quản trị, bảo vệ cấu hình hệ thống của bạn."
      actions={
        <Badge variant={authEnabled ? 'success' : 'default'} size="sm">
          {authEnabled ? 'Đã bật' : 'Chưa bật'}
        </Badge>
      }
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="rounded-xl border border-border/50 bg-muted/20 p-4 shadow-soft-card-strong transition-all hover:bg-muted/30">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">Xác thực quản trị</p>
              <p className="text-xs leading-6 text-muted-text">{helperText}</p>
            </div>
            <Checkbox
              checked={desiredEnabled}
              disabled={isSubmitting}
              label={desiredEnabled ? 'Bật' : 'Tắt'}
              onCheckedChange={(checked) => setDesiredEnabled(checked === true)}
              containerClassName="bg-muted/30 border border-border/50 rounded-full px-4 py-2 shadow-soft-card-strong transition-all hover:bg-muted/40"
            />
          </div>
        </div>

        {/* Password input fields logic based on setupState and desiredEnabled */}
        {(desiredEnabled || (authEnabled && !desiredEnabled)) && (
          <div className="grid gap-4 md:grid-cols-2">
            {/* Show Current Password if we have one and we're either re-enabling or turning off */}
            {(setupState === 'password_retained' && desiredEnabled) || 
             (setupState === 'enabled' && !desiredEnabled) ? (
              <div className="space-y-3">
                <Input
                  label="Mật khẩu quản trị hiện tại"
                  type="password"
                  allowTogglePassword
                  iconType="password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  autoComplete="current-password"
                  disabled={isSubmitting}
                  placeholder="Nhập mật khẩu hiện tại"
                  hint={setupState === 'password_retained' ? 'Nhập mật khẩu cũ để kích hoạt lại xác thực' : 'Có thể cần xác minh danh tính trước khi tắt xác thực'}
                />
              </div>
            ) : null}

            {/* Show New Password fields only during initial setup */}
            {setupState === 'no_password' && desiredEnabled ? (
              <>
                <div className="space-y-3">
                  <Input
                    label="Đặt mật khẩu quản trị"
                    type="password"
                    allowTogglePassword
                    iconType="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="new-password"
                    disabled={isSubmitting}
                    placeholder="Nhập mật khẩu mới (tối thiểu 6 ký tự)"
                  />
                </div>
                <div className="space-y-3">
                  <Input
                    label="Xác nhận mật khẩu mới"
                    type="password"
                    allowTogglePassword
                    iconType="password"
                    value={passwordConfirm}
                    onChange={(event) => setPasswordConfirm(event.target.value)}
                    autoComplete="new-password"
                    disabled={isSubmitting}
                    placeholder="Nhập lại để xác nhận"
                  />
                </div>
              </>
            ) : null}
          </div>
        )}

        {error ? (
          isParsedApiError(error) ? (
            <SettingsAlert
              title="Cài đặt xác thực thất bại"
              message={error.message}
              variant="error"
            />
          ) : (
            <SettingsAlert title="Cài đặt xác thực thất bại" message={error} variant="error" />
          )
        ) : null}

        {successMessage ? (
          <SettingsAlert title="Thao tác thành công" message={successMessage} variant="success" />
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" variant="settings-primary" isLoading={isSubmitting} disabled={!isDirty}>
            {targetActionLabel}
          </Button>
          <Button
            type="button"
            variant="settings-secondary"
            onClick={() => {
              setDesiredEnabled(authEnabled);
              setError(null);
              setSuccessMessage(null);
              resetForm();
            }}
            disabled={isSubmitting || !isDirty}
          >
            Hoàn tác
          </Button>
        </div>
      </form>
    </SettingsSectionCard>
  );
};
