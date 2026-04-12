import type React from 'react';
import { useState } from 'react';
import type { ParsedApiError } from '../../api/error';
import { isParsedApiError } from '../../api/error';
import { useAuth } from '../../hooks';
import { Button, Input } from '../common';
import { SettingsAlert } from './SettingsAlert';
import { SettingsSectionCard } from './SettingsSectionCard';

export const ChangePasswordCard: React.FC = () => {
  const { changePassword } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | ParsedApiError | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!currentPassword.trim()) {
      setError('Vui lòng nhập mật khẩu hiện tại');
      return;
    }
    if (!newPassword.trim()) {
      setError('Vui lòng nhập mật khẩu mới');
      return;
    }
    if (newPassword.length < 6) {
      setError('Mật khẩu mới tối thiểu 6 ký tự');
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      setError('Hai lần nhập mật khẩu mới không khớp');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await changePassword(currentPassword, newPassword, newPasswordConfirm);
      if (result.success) {
        setSuccess(true);
        setCurrentPassword('');
        setNewPassword('');
        setNewPasswordConfirm('');
        setTimeout(() => setSuccess(false), 4000);
      } else {
        setError(result.error ?? 'Thay đổi thất bại');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SettingsSectionCard
      title="Đổi mật khẩu"
      description="Cập nhật mật khẩu đăng nhập quản trị hiện tại. Sau khi đổi thành công, hãy dùng mật khẩu mới để đăng nhập."
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <Input
              id="change-pass-current"
              type="password"
              allowTogglePassword
              iconType="password"
              label="Mật khẩu hiện tại"
              placeholder="Nhập mật khẩu hiện tại"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              disabled={isSubmitting}
              autoComplete="current-password"
            />
          </div>

          <div className="space-y-3">
            <Input
              id="change-pass-new"
              type="password"
              allowTogglePassword
              iconType="password"
              label="Mật khẩu mới"
              hint="Tối thiểu 6 ký tự."
              placeholder="Nhập mật khẩu mới"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={isSubmitting}
              autoComplete="new-password"
            />
          </div>
        </div>

        <div className="space-y-3 md:max-w-md">
          <Input
            id="change-pass-confirm"
            type="password"
            allowTogglePassword
            iconType="password"
            label="Xác nhận mật khẩu mới"
            placeholder="Nhập lại mật khẩu mới"
            value={newPasswordConfirm}
            onChange={(e) => setNewPasswordConfirm(e.target.value)}
            disabled={isSubmitting}
            autoComplete="new-password"
          />
        </div>

        {error
          ? isParsedApiError(error)
            ? <SettingsAlert title="Đổi mật khẩu thất bại" message={error.message} variant="error" className="!mt-3" />
            : <SettingsAlert title="Đổi mật khẩu thất bại" message={error} variant="error" className="!mt-3" />
          : null}
        {success ? (
          <SettingsAlert title="Đổi mật khẩu thành công" message="Mật khẩu quản trị đã được cập nhật." variant="success" />
        ) : null}

        <Button type="submit" variant="primary" isLoading={isSubmitting}>
          Lưu mật khẩu mới
        </Button>
      </form>
    </SettingsSectionCard>
  );
};
