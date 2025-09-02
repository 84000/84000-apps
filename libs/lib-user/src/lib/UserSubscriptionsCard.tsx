'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Switch,
} from '@design-system';
import { SUBSCRIPTION_TYPES, SubscriptionType } from './types';
import { useCallback, useEffect, useState } from 'react';
import { useProfile } from './ProfileProvider';

const NOTIFICATION_LABELS: Record<SubscriptionType, string> = {
  news: "The Scholar's Room Newsletter",
};

export const UserSubscriptionsCard = () => {
  const { user, saveProfile } = useProfile();
  const [subscriptions, setSubscriptions] = useState(user?.subscriptions || []);

  useEffect(() => {
    setSubscriptions(user?.subscriptions || []);
  }, [user?.subscriptions]);

  const toggleSubscription = useCallback(
    (type: SubscriptionType, isOn: boolean) => {
      const newSubscriptions = isOn
        ? [...subscriptions, type]
        : subscriptions.filter((t) => t !== type);
      setSubscriptions(newSubscriptions);
      saveProfile({ subscriptions: newSubscriptions });
    },
    [subscriptions, saveProfile],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notifications</CardTitle>
        <CardDescription>
          Manage your email notifications and subscriptions.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex flex-row gap-4">
          {SUBSCRIPTION_TYPES.map((type) => (
            <div key={type} className="flex flex-col gap-1">
              <div className="flex flex-row gap-2">
                <Switch
                  className="my-auto"
                  checked={subscriptions.includes(type)}
                  onCheckedChange={(checked) =>
                    toggleSubscription(type, checked)
                  }
                />
                <span>{NOTIFICATION_LABELS[type]}</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
