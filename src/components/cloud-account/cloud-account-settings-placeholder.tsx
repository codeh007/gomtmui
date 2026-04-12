"use client";

import { Card, CardContent, CardHeader, CardTitle } from "mtxuilib/ui/card";
import { Separator } from "mtxuilib/ui/separator";

type CloudAccountSettingsSection = {
  title: string;
  description: string;
};

export function CloudAccountSettingsPlaceholder(props: {
  description: string;
  sections: CloudAccountSettingsSection[];
}) {
  const { description, sections } = props;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Settings</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Separator />

      {sections.map((section) => (
        <Card key={section.title}>
          <CardHeader>
            <CardTitle>{section.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{section.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
