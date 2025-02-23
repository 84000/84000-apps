import { Icon } from '@iconify/react';
import { Button, Dropdown } from 'flowbite-react';
import Image from 'next/image';
import SimpleBar from 'simplebar-react';
import { ScholarUser } from '../../../../context/SessionContext';
const Profile = ({
  user,
  handleLogout,
}: {
  user: ScholarUser;
  handleLogout: () => void;
}) => {
  return (
    <div className="relative ">
      <Dropdown
        label=""
        className="w-screen sm:w-[360px] pb-4 rounded-sm"
        dismissOnClick={false}
        renderTrigger={() => (
          <div className="flex items-center gap-1">
            <span className="h-10 w-10 hover:text-primary rounded-full flex justify-center items-center cursor-pointer group-hover/menu:bg-lightprimary group-hover/menu:text-primary">
              <Image
                src={user?.avatar || '/images/profile/user-1.jpg'}
                alt="logo"
                height="35"
                width="35"
                className="rounded-full"
              />
            </span>
            <Icon
              icon="solar:alt-arrow-down-bold"
              className="hover:text-primary dark:text-primary group-hover/menu:text-primary"
              height={12}
            />
          </div>
        )}
      >
        <div className="px-6">
          <div className="flex items-center gap-6 pb-5 border-b dark:border-darkborder mt-5 mb-3">
            <Image
              src={user?.avatar || '/images/profile/user-1.jpg'}
              alt="logo"
              height="56"
              width="56"
              className="rounded-full"
            />
            <div>
              <h5 className="text-15 font-semibold">{user?.name}</h5>
              <p className="text-sm text-ld opacity-80">{user?.username}</p>
            </div>
          </div>
        </div>
        <SimpleBar>
          <div className="px-6 mb-2">
            <Dropdown.Item
              as={Button}
              onClick={handleLogout}
              className="px-3 py-2 flex justify-between items-center bg-hover group/link w-full rounded-md"
            >
              <div className="flex items-center w-full ">
                <div className=" flex gap-3 w-full ">
                  <h5 className="text-15 font-normal group-hover/link:text-primary">
                    Sign Out
                  </h5>
                </div>
              </div>
            </Dropdown.Item>
          </div>
        </SimpleBar>
      </Dropdown>
    </div>
  );
};

export default Profile;
